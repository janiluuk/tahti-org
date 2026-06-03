// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * Contract tests for stable public /api/v1/* JSON shapes (future-improvements P2).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  allocateMemberNumber,
  cleanupUsersByEmailPrefix,
  createPublishedReleaseWithTrack,
  createTestArtist,
} from '../../test/helpers.js'

const PREFIX = 'contract-v1-'

describe('Public API v1 contracts', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let username: string
  let smartSlug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      tier: 'ARTIST',
      isMember: true,
      memberNumber: await allocateMemberNumber(prisma),
    })
    username = artist.username
    const release = await createPublishedReleaseWithTrack(prisma, artist.id, {
      smartLinkSlug: `${PREFIX}ep`,
    })
    smartSlug = release.smartLinkSlug!
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET /api/v1/transparency/ytd', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/transparency/ytd' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toMatchObject({
      year: expect.any(String),
      runningSurplus: expect.any(String),
      byCategory: expect.any(Object),
      monthsFinalized: expect.any(Number),
    })
  })

  it('GET /api/v1/u/:username/profile', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/u/${username}/profile`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.artist).toMatchObject({
      username,
      displayName: expect.any(String),
    })
    expect(body.links).toMatchObject({
      channel: expect.stringContaining('/c/'),
    })
  })

  it('GET /api/v1/r/:slug smart link', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/r/${smartSlug}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.release).toMatchObject({
      title: expect.any(String),
      smartLinkSlug: smartSlug,
    })
  })

  it('GET /api/v1/status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/status' })
    expect([200, 503]).toContain(res.statusCode)
    const body = res.json()
    expect(body).toMatchObject({
      status: expect.stringMatching(/operational|degraded|outage/),
      checks: expect.any(Object),
      uptimeSec: expect.any(Number),
    })
  })

  it('GET /api/v1/radio', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/radio' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      live: expect.any(Boolean),
    })
  })

  it('GET /api/v1/embed/c/:slug', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/embed/c/${username}`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      slug: username,
      profileUrl: expect.stringContaining(`/u/${username}`),
      embedUrl: expect.stringContaining('/embed/c/'),
    })
  })
})
