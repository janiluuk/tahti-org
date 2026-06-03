// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../test/helpers.js'
import { buildGateDailySeries, GATE_DAILY_SERIES_DAYS } from './download-gate-daily.js'

const PREFIX = 'gate-daily-'

describe('buildGateDailySeries', () => {
  let channelId: string
  let gatedItemId: string

  beforeAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'gate-daily-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98641,
    })
    channelId = artist.channel!.id

    const item = await prisma.archiveItem.create({
      data: {
        channelId,
        title: 'Daily Gate Mix',
        rawKey: 'raw/daily.wav',
        mp3Key: 'mp3/daily.mp3',
        fileSizeBytes: BigInt(500_000),
        status: 'READY',
        isPublic: true,
        repostToDownload: true,
      },
    })
    gatedItemId = item.id

    await prisma.archiveRepostAck.create({
      data: { archiveItemId: gatedItemId, byFingerprint: 'fp-daily-today' },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('returns fixed-length UTC day buckets with today’s repost ack', async () => {
    const daily = await buildGateDailySeries(prisma, channelId)
    expect(daily).toHaveLength(GATE_DAILY_SERIES_DAYS)
    const today = new Date().toISOString().slice(0, 10)
    const todayRow = daily.find((d) => d.date === today)
    expect(todayRow?.repostAcks).toBeGreaterThanOrEqual(1)
  })
})
