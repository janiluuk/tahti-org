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
  let soundId: string
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

    const item = await prisma.sound.create({
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
    soundId = item.id

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
        soundId,
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

  it('GET /api/me/stats/summary returns today + all-time counters', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/stats/summary',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      playsToday: number
      playsTotal: number
      downloadsToday: number
      downloadsTotal: number
    }
    expect(body.downloadsToday).toBeGreaterThanOrEqual(1)
    expect(body.downloadsTotal).toBeGreaterThanOrEqual(1)
    expect(body.playsToday).toBeGreaterThanOrEqual(1)
    expect(body.playsTotal).toBe(body.downloadsTotal + 1) // + the seeded smart-link click
  })

  it('GET /api/me/stats/summary requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/stats/summary' })
    expect(res.statusCode).toBe(401)
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

  it('GET /api/me/stats/plays/hourly returns 24 UTC buckets', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/stats/plays/hourly?date=${today}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { date: string; hours: number[]; totalPlays: number }
    expect(body.date).toBe(today)
    expect(body.hours).toHaveLength(24)
    expect(body.hours.reduce((sum, value) => sum + value, 0)).toBe(body.totalPlays)
    expect(body.totalPlays).toBeGreaterThanOrEqual(1)
  })

  it('GET /api/me/stats/plays/hourly rejects bad dates', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/stats/plays/hourly?date=not-a-day',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /api/me/stats/top-tracks ranks sound items', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/stats/top-tracks',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { items: Array<{ soundId: string; plays: number }> }
    expect(body.items.some((i) => i.soundId === soundId && i.plays >= 1)).toBe(true)
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
