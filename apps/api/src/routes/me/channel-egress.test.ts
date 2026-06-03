// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'egress-stats-'

describe('GET /api/me/channel-egress', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let channelId: string
  let itemId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'egress-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98530,
    })
    cookie = await sessionCookieFor(prisma, artist.id)

    const channel = await prisma.channel.findUniqueOrThrow({
      where: { userId: artist.id },
      select: { id: true },
    })
    channelId = channel.id

    const item = await prisma.archiveItem.create({
      data: {
        channelId,
        title: 'Egress mix',
        rawKey: 'raw/egress.wav',
        mp3Key: 'test/egress.mp3',
        status: 'READY',
        isPublic: true,
        fileSizeBytes: BigInt(5_000_000),
      },
    })
    itemId = item.id

    await prisma.download.create({
      data: {
        channelId,
        archiveItemId: itemId,
        format: 'mp3_320',
        byFingerprint: 'egress-fp-1',
        byIpHash: 'egress-ip-1',
        bytes: 5_000_000,
        countedAt: new Date(),
        weight: 1,
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns 30-day download bytes for the artist channel', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/channel-egress',
      headers: { cookie },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      windowDays: number
      totalBytes: number
      totalDownloads: number
      daily: Array<{ date: string; bytes: number; downloads: number }>
    }
    expect(body.windowDays).toBe(30)
    expect(body.totalBytes).toBeGreaterThanOrEqual(5_000_000)
    expect(body.totalDownloads).toBeGreaterThanOrEqual(1)
    expect(body.daily.some((d) => d.bytes >= 5_000_000)).toBe(true)
  })
})
