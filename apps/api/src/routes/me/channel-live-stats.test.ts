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

const PREFIX = 'live-stats-'

describe('M22 — channel live stats', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let channelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'live-stats-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: await allocateMemberNumber(prisma),
    })
    channelId = artist.channel!.id
    cookie = await sessionCookieFor(prisma, artist.id)

    const day = new Date()
    day.setUTCHours(12, 0, 0, 0)
    const ended = new Date(day.getTime() + 90 * 60 * 1000)

    await prisma.broadcast.create({
      data: {
        channelId,
        source: 'RTMP',
        startedAt: day,
        endedAt: ended,
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns live seconds series for authenticated artist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/channel-live-stats',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      totalLiveSeconds: number
      totalBroadcasts: number
      daily: Array<{ liveSeconds: number }>
    }
    expect(body.totalLiveSeconds).toBeGreaterThanOrEqual(5400)
    expect(body.totalBroadcasts).toBeGreaterThanOrEqual(1)
    expect(body.daily.length).toBe(14)
  })

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/channel-live-stats' })
    expect(res.statusCode).toBe(401)
  })
})
