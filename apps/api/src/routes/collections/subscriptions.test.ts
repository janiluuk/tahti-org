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

const PREFIX = 'col-subs-list-'

describe('GET /api/me/collection-subscriptions', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
      displayName: 'Curator',
    })
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan@example.com`,
      username: `${PREFIX}fan`,
    })
    cookie = await sessionCookieFor(prisma, fan.id)

    const make = (slug: string, data: Record<string, unknown> = {}) =>
      prisma.collection.create({ data: { userId: owner.id, slug, name: slug, ...data } })
    const older = await make(`${PREFIX}older`)
    const unlisted = await make(`${PREFIX}unlisted`, { isPublic: false, visibility: 'UNLISTED' })
    const draft = await make(`${PREFIX}draft`, { isPublic: false, visibility: 'DRAFT' })
    const sound = await prisma.sound.create({
      data: { channelId: owner.channel!.id, title: 'In it', status: 'READY', isPublic: true },
    })
    await prisma.collectionItem.create({
      data: { collectionId: older.id, soundId: sound.id, position: 1 },
    })

    const base = Date.UTC(2026, 9, 1, 12, 0)
    await prisma.collectionSubscription.createMany({
      data: [older, draft, unlisted].map((c, i) => ({
        userId: fan.id,
        collectionId: c.id,
        createdAt: new Date(base + i * 60_000),
      })),
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('requires a session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/collection-subscriptions' })
    expect(res.statusCode).toBe(401)
  })

  it('lists the collections you can still open, newest subscription first', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/collection-subscriptions',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const items = res.json().items as Array<{
      slug: string
      itemCount: number
      ownerUsername: string
      ownerDisplayName: string
    }>
    expect(items.map((i) => i.slug)).toEqual([`${PREFIX}unlisted`, `${PREFIX}older`])
    expect(items[1]).toMatchObject({
      itemCount: 1,
      ownerUsername: `${PREFIX}owner`,
      ownerDisplayName: 'Curator',
    })
  })
})
