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

const PREFIX = 'stats-loyalty-test-'

describe('GET /api/me/stats/loyalty', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let channelId: string
  let soundId: string
  let quietSoundId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      displayName: 'Loyalty Artist',
    })
    channelId = artist.channel!.id
    cookie = await sessionCookieFor(prisma, artist.id)
    soundId = (
      await prisma.sound.create({
        data: { channelId, title: 'Loyal Track', status: 'READY', isPublic: true },
      })
    ).id
    quietSoundId = (
      await prisma.sound.create({
        data: { channelId, title: 'Quiet Track', status: 'READY', isPublic: true },
      })
    ).id
    const listen = (sound: string, maxPositionSec: number, i: number) => ({
      channelId,
      soundId: sound,
      byFingerprint: `${PREFIX}${sound}-${i}`,
      byIpHash: 'x',
      source: 'CHANNEL_PAGE' as const,
      maxPositionSec,
      durationSec: 200,
    })
    await prisma.listenSession.createMany({
      data: [
        ...[0, 30, 100, 150, 200].map((position, i) => listen(soundId, position, i)),
        ...[100, 100].map((position, i) => listen(quietSoundId, position, i)),
        { ...listen(soundId, 50, 99), durationSec: null },
      ],
    })
  })

  afterAll(async () => {
    await prisma.listenSession.deleteMany({ where: { channelId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const get = (query: string) =>
    app.inject({ method: 'GET', url: `/api/me/stats/loyalty?${query}`, headers: { cookie } })

  it('gives the share of listens that reached each tenth of the track', async () => {
    const res = await get(`range=all&soundId=${soundId}`)
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      total: 5,
      minBucket: 5,
      points: [
        { percent: 0, share: 1 },
        { percent: 10, share: 0.8 },
        { percent: 20, share: 0.6 },
        { percent: 30, share: 0.6 },
        { percent: 40, share: 0.6 },
        { percent: 50, share: 0.6 },
        { percent: 60, share: 0.4 },
        { percent: 70, share: 0.4 },
        { percent: 80, share: 0.2 },
        { percent: 90, share: 0.2 },
        { percent: 100, share: 0.2 },
      ],
    })
  })

  it('gives no curve until enough listens report a position', async () => {
    const res = await get(`range=all&soundId=${quietSoundId}`)
    expect(res.json()).toEqual({ total: 2, minBucket: 5, points: [] })
  })
})
