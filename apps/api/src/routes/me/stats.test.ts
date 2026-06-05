// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  allocateMemberNumber,
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'me-stats-'

describe('PLAT-030 — artist stats API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let userId: string
  let channelId: string
  let archiveItemId: string
  let releaseId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'me-stats-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: await allocateMemberNumber(prisma),
    })
    userId = artist.id
    cookie = await sessionCookieFor(prisma, artist.id)

    const channel = await prisma.channel.findUniqueOrThrow({
      where: { userId },
      select: { id: true },
    })
    channelId = channel.id

    const item = await prisma.archiveItem.create({
      data: {
        channelId,
        title: 'Stats Test Track',
        status: 'READY',
        rawKey: 'raw/me-stats/test.wav',
        mp3Key: 'test/stats-track.mp3',
        fileSizeBytes: 0,
        durationSec: 120,
        isPublic: true,
      },
    })
    archiveItemId = item.id

    const release = await prisma.release.create({
      data: {
        userId,
        title: 'Stats EP',
        type: 'EP',
        state: 'PUBLISHED',
        releaseDate: new Date(),
        smartLinkSlug: `${PREFIX}ep`,
      },
    })
    releaseId = release.id

    await prisma.download.create({
      data: {
        channelId,
        archiveItemId,
        format: 'mp3',
        byFingerprint: 'stats-fp-1',
        byIpHash: 'stats-ip-1',
        countedAt: new Date(),
        weight: 1,
      },
    })

    await prisma.smartLinkClick.create({
      data: {
        releaseId,
        platform: 'spotify',
        referer: 'https://open.spotify.com/track/1',
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET /api/me/stats/plays returns daily series', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/stats/plays?range=30',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      range: string
      totalPlays: number
      totalDownloads: number
      totalSmartLinkClicks: number
      daily: Array<{ date: string; plays: number }>
    }
    expect(body.range).toBe('30')
    expect(body.totalDownloads).toBeGreaterThanOrEqual(1)
    expect(body.totalSmartLinkClicks).toBeGreaterThanOrEqual(1)
    expect(body.totalPlays).toBe(body.totalDownloads + body.totalSmartLinkClicks)
    expect(body.daily).toHaveLength(30)
  })

  it('GET /api/me/stats/top-tracks ranks archive items', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/stats/top-tracks',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { items: Array<{ archiveItemId: string; plays: number }> }
    expect(body.items.some((i) => i.archiveItemId === archiveItemId && i.plays >= 1)).toBe(true)
  })

  it('GET /api/me/stats/top-countries groups referer clicks', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/stats/top-countries',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { items: Array<{ country: string; count: number }> }
    expect(body.items.length).toBeGreaterThanOrEqual(1)
    expect(body.items[0]?.count).toBeGreaterThanOrEqual(1)
  })
})
