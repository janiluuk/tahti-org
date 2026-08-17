// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'top-lists-test-'

describe('/api/top-lists', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let plainCookie: string
  let popularId: string
  let quietId: string
  let ineligibleId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
      displayName: 'Top Lists Owner',
    })
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      displayName: 'Top Lists Board',
      isBoard: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
    plainCookie = await sessionCookieFor(prisma, owner.id)

    const popular = await prisma.archiveItem.create({
      data: {
        channelId: owner.channel!.id,
        title: 'Popular Track',
        status: 'READY',
        isPublic: true,
        contentType: 'DJ_MIX',
        genre: 'Techno',
      },
    })
    popularId = popular.id

    const quiet = await prisma.archiveItem.create({
      data: {
        channelId: owner.channel!.id,
        title: 'Quiet Track',
        status: 'READY',
        isPublic: true,
        contentType: 'DJ_MIX',
        genre: 'Techno',
      },
    })
    quietId = quiet.id

    const ineligible = await prisma.archiveItem.create({
      data: {
        channelId: owner.channel!.id,
        title: 'Ineligible Track',
        status: 'READY',
        isPublic: true,
        contentType: 'DJ_MIX',
        topListsEligible: false,
      },
    })
    ineligibleId = ineligible.id

    // 3 listens for popular, 1 for quiet, and one (would-be) listen for the
    // ineligible track — all inserted directly since the dedupe/eligibility
    // rules are the API route's job, not this fixture's.
    await prisma.listenEvent.createMany({
      data: [
        { archiveItemId: popularId, dedupeKey: 'l1', dayBucket: '2026-07-01' },
        { archiveItemId: popularId, dedupeKey: 'l2', dayBucket: '2026-07-01' },
        { archiveItemId: popularId, dedupeKey: 'l3', dayBucket: '2026-07-01' },
        { archiveItemId: quietId, dedupeKey: 'l1', dayBucket: '2026-07-01' },
        { archiveItemId: ineligibleId, dedupeKey: 'l1', dayBucket: '2026-07-01' },
      ],
    })
  })

  afterAll(async () => {
    await app.close()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('ranks the public top list by listens, excluding ineligible tracks', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/top-lists?period=all_time' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    const ids = body.entries.map((e: { archiveItemId: string }) => e.archiveItemId)
    expect(ids).toContain(popularId)
    expect(ids).toContain(quietId)
    expect(ids).not.toContain(ineligibleId)
    expect(ids.indexOf(popularId)).toBeLessThan(ids.indexOf(quietId))
  })

  it('filters by contentTypes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/top-lists?period=all_time&contentTypes=RADIO_SHOW',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().entries).toEqual([])
  })

  it('returns 400 for an invalid period', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/top-lists?period=nonsense' })
    expect(res.statusCode).toBe(400)
  })

  it('rank lookup returns the best rank for tracks that place', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/top-lists/ranks?ids=${popularId},${quietId},unknown-id`,
    })
    expect(res.statusCode).toBe(200)
    const ranks = res.json().ranks
    expect(ranks[popularId]).toBe(1)
    expect(ranks[quietId]).toBeGreaterThan(1)
    expect(ranks['unknown-id']).toBeUndefined()
  })

  it('admin top-lists requires board auth', async () => {
    const anon = await app.inject({
      method: 'GET',
      url: '/api/admin/top-lists?period=all_time&dimension=type',
    })
    expect(anon.statusCode).toBe(401)

    const nonBoard = await app.inject({
      method: 'GET',
      url: '/api/admin/top-lists?period=all_time&dimension=type',
      headers: { cookie: plainCookie },
    })
    expect(nonBoard.statusCode).toBe(403)
  })

  it('admin top-lists buckets by dimension and supports asc sort for least-listened', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/top-lists?period=all_time&dimension=type',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    const djMixBucket = body.buckets.find((b: { bucket: string }) => b.bucket === 'DJ_MIX')
    expect(djMixBucket).toBeDefined()
    expect(djMixBucket.entries[0].archiveItemId).toBe(popularId)

    const leastRes = await app.inject({
      method: 'GET',
      url: '/api/admin/top-lists?period=all_time&dimension=type&sort=asc',
      headers: { cookie: boardCookie },
    })
    const leastBucket = leastRes
      .json()
      .buckets.find((b: { bucket: string }) => b.bucket === 'DJ_MIX')
    expect(leastBucket.entries[0].archiveItemId).toBe(quietId)
  })

  it('admin top-lists buckets by genre', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/top-lists?period=all_time&dimension=genre',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    const technoBucket = res.json().buckets.find((b: { bucket: string }) => b.bucket === 'Techno')
    expect(technoBucket).toBeDefined()
    expect(technoBucket.entries.map((e: { archiveItemId: string }) => e.archiveItemId)).toEqual([
      popularId,
      quietId,
    ])
  })

  it('shows an artist only their own content under dashboard top lists', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/stats/top-lists?period=all_time&dimension=type&sort=desc',
      headers: { cookie: plainCookie },
    })
    expect(res.statusCode).toBe(200)
    const entries = res.json().buckets.flatMap((bucket: { entries: unknown[] }) => bucket.entries)
    expect(entries.map((entry: { archiveItemId: string }) => entry.archiveItemId)).toEqual([
      popularId,
      quietId,
    ])
  })
})
