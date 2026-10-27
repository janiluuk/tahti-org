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

const PREFIX = 'stats-own-listens-'

describe('Studio audience stats leave out the artist’s own listening', () => {
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
    })
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan@example.com`,
      username: `${PREFIX}fan`,
    })
    channelId = artist.channel!.id
    cookie = await sessionCookieFor(prisma, artist.id)
    const now = Date.now()
    const session = (i: number, byUserId: string | null, uaBrowser: string) => ({
      channelId,
      byUserId,
      byFingerprint: `${PREFIX}${i}`,
      byIpHash: 'x',
      source: 'CHANNEL_PAGE' as const,
      uaBrowser,
      startedAt: new Date(now - 10 * 60_000),
      lastSeenAt: new Date(now),
    })
    await prisma.listenSession.createMany({
      data: [
        ...Array.from({ length: 6 }, (_, i) => session(i, artist.id, 'Safari')),
        ...Array.from({ length: 5 }, (_, i) => session(10 + i, fan.id, 'Firefox')),
        ...Array.from({ length: 5 }, (_, i) => session(20 + i, null, 'Chrome')),
      ],
    })
  })

  afterAll(async () => {
    await prisma.listenSession.deleteMany({ where: { channelId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const get = async (path: string) => {
    const res = await app.inject({ method: 'GET', url: path, headers: { cookie } })
    expect(res.statusCode).toBe(200)
    return res.json()
  }

  it('counts signed-out and other listeners, not the artist', async () => {
    const audience = await get('/api/me/stats/audience?dimension=browser&range=7')
    expect(audience.total).toBe(10)
    expect(audience.items.map((i: { name: string }) => i.name).sort()).toEqual([
      'Chrome',
      'Firefox',
    ])

    const listening = await get('/api/me/stats/listening?range=7')
    expect(listening.listens).toBe(10)

    const locations = await get('/api/me/stats/locations?range=7')
    expect(locations.total).toBe(10)
  })
})
