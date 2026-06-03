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

const PREFIX = 'gate-stats-ch-'

describe('GET /api/me/download-gate-stats', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let gatedItemId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'gate-stats-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98640,
    })
    cookie = await sessionCookieFor(prisma, artist.id)

    const item = await prisma.archiveItem.create({
      data: {
        channelId: artist.channel!.id,
        title: 'Gated Mix',
        rawKey: 'raw/gated.wav',
        mp3Key: 'mp3/gated.mp3',
        fileSizeBytes: BigInt(1_000_000),
        status: 'READY',
        isPublic: true,
        repostToDownload: true,
      },
    })
    gatedItemId = item.id

    await prisma.archiveRepostAck.create({
      data: {
        archiveItemId: gatedItemId,
        byFingerprint: 'fp-gate-stats',
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns channel-level gate funnel summary', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/download-gate-stats',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.items.length).toBeGreaterThanOrEqual(1)
    expect(body.totals.repostAcks).toBeGreaterThanOrEqual(1)
    const row = body.items.find((i: { archiveItemId: string }) => i.archiveItemId === gatedItemId)
    expect(row?.repostAckCount).toBeGreaterThanOrEqual(1)
    expect(Array.isArray(body.daily)).toBe(true)
    expect(body.daily.length).toBe(14)
    const today = new Date().toISOString().slice(0, 10)
    const todayPoint = body.daily.find((d: { date: string }) => d.date === today)
    expect(todayPoint?.repostAcks).toBeGreaterThanOrEqual(1)
  })
})
