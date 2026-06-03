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

const PREFIX = 'gate-stats-'

describe('GET /api/me/download-gate-stats', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let channelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'gate-stats-user',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98550,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    channelId = (
      await prisma.channel.findUniqueOrThrow({
        where: { userId: artist.id },
        select: { id: true },
      })
    ).id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns totals with countedDownloads and daily series', async () => {
    const item = await prisma.archiveItem.create({
      data: {
        channelId,
        title: 'Gated mix',
        rawKey: 'raw/gate.mp3',
        mp3Key: 'mp3/gate.mp3',
        durationSec: 60,
        fileSizeBytes: 1000,
        status: 'READY',
        repostToDownload: true,
      },
    })

    await prisma.download.create({
      data: {
        channelId,
        archiveItemId: item.id,
        format: 'mp3_320',
        byFingerprint: 'gate-fp-1',
        byIpHash: 'gate-ip-1',
        bytes: 5000,
        reason: 'gate_repost',
        countedAt: new Date(),
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/me/download-gate-stats',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      totals: { countedDownloads: number }
      items: Array<{ countedDownloadCount: number }>
      daily: unknown[]
    }
    expect(body.totals.countedDownloads).toBeGreaterThanOrEqual(1)
    expect(body.items[0]?.countedDownloadCount).toBeGreaterThanOrEqual(1)
    expect(body.daily.length).toBeGreaterThan(0)
  })
})
