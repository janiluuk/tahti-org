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

const PREFIX = 'stats-listening-test-'

describe('GET /api/me/stats/listening', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let channelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      displayName: 'Listening Artist',
    })
    channelId = artist.channel!.id
    cookie = await sessionCookieFor(prisma, artist.id)
    const now = Date.now()
    const session = (i: number, minutes: number, extra: object = {}) => ({
      channelId,
      byFingerprint: `${PREFIX}${i}`,
      byIpHash: 'x',
      source: 'CHANNEL_PAGE' as const,
      startedAt: new Date(now - minutes * 60_000),
      lastSeenAt: new Date(now),
      ...extra,
    })
    await prisma.listenSession.createMany({
      data: [
        session(1, 30),
        session(2, 6),
        session(3, 0, { maxPositionSec: 240 }),
        session(4, 90, { isBot: true }),
      ],
    })
  })

  afterAll(async () => {
    await prisma.listenSession.deleteMany({ where: { channelId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('adds up minutes listened, counting a short track listen by its position', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/stats/listening?range=7',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ listens: 3, minutes: 40, averageMinutes: 13.3 })
  })

  it('includes bots only when asked', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/stats/listening?range=7&includeBots=true',
      headers: { cookie },
    })
    expect(res.json()).toMatchObject({ listens: 4, minutes: 130 })
  })
})
