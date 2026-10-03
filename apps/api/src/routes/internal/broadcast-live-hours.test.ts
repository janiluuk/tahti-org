// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { readFile } from 'node:fs/promises'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { utcWeekStart } from '@tahti/shared/broadcast-cap'
import { endBroadcast } from '@tahti/shared/broadcast-end'
import { forceChannelOffline } from '../../lib/force-channel-offline.js'

vi.mock('../../lib/queue.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/queue.js')>()
  return {
    ...actual,
    enqueueFinalizeBroadcastRecording: vi.fn().mockResolvedValue(undefined),
    enqueueWarmSoundFallbackCache: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('../../lib/orchestrator.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/orchestrator.js')>()
  return {
    ...actual,
    spawnChannelLiquidsoap: vi.fn().mockResolvedValue(undefined),
    stopOrchestratorChannel: vi.fn().mockResolvedValue(undefined),
  }
})

const PREFIX = 'live-hours-test-'
const SLUG = 'live-hours-artist'
const STREAM_KEY = `${SLUG}__live-hours-secret`
const LIVE_SOURCE_PASS = 'live-hours-ice-pass'
const HOUR_MS = 60 * 60 * 1000

const form = { 'content-type': 'application/x-www-form-urlencoded' }

describe('Channel.totalLiveHours', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let channelId: string

  async function totalLiveHours(): Promise<number> {
    const channel = await prisma.channel.findUniqueOrThrow({ where: { id: channelId } })
    return channel.totalLiveHours
  }

  async function openLiveBroadcast(liveForMs: number) {
    const now = Date.now()
    await prisma.channel.update({
      where: { id: channelId },
      data: { state: 'LIVE', goneLiveAt: new Date(now - liveForMs) },
    })
    return prisma.broadcast.create({
      data: {
        channelId,
        source: 'RTMP',
        startedAt: new Date(now - liveForMs - 10 * 60 * 1000),
        wentLiveAt: new Date(now - liveForMs),
      },
    })
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })

    const user = await prisma.user.create({
      data: {
        email: `${PREFIX}artist@example.com`,
        passwordHash: await hashPassword('testpassword'),
        username: SLUG,
        displayName: 'Live Hours Test',
        tier: 'ARTIST',
        weeklyLiveSecondsUsed: 0,
        weeklyLiveResetAt: utcWeekStart(new Date()),
        channel: {
          create: {
            slug: SLUG,
            liveSourceMount: `/live/${SLUG}`,
            liveSourcePass: LIVE_SOURCE_PASS,
            liveSourcePassHash: await hashPassword(LIVE_SOURCE_PASS),
            rtmpStreamKey: STREAM_KEY,
            rtmpStreamKeyHash: await hashPassword(STREAM_KEY),
          },
        },
      },
      include: { channel: true },
    })
    channelId = user.channel!.id
  })

  beforeEach(async () => {
    await prisma.broadcast.deleteMany({ where: { channelId } })
    await prisma.channel.update({
      where: { id: channelId },
      data: { state: 'OFFLINE', goneLiveAt: null, totalLiveHours: 0 },
    })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await app.close()
  })

  it('adds the live time of a session ended by RTMP on_done', async () => {
    await openLiveBroadcast(2 * HOUR_MS)

    const res = await app.inject({
      method: 'POST',
      url: '/internal/rtmp/on_done',
      headers: form,
      payload: `name=${encodeURIComponent(STREAM_KEY)}`,
    })
    expect(res.statusCode).toBe(200)
    expect(await totalLiveHours()).toBeCloseTo(2, 2)
  })

  it('adds the live time of a session ended by Icecast disconnect', async () => {
    await openLiveBroadcast(90 * 60 * 1000)

    const res = await app.inject({
      method: 'POST',
      url: '/internal/icecast/on_disconnect',
      headers: form,
      payload: `mount=/live/${SLUG}`,
    })
    expect(res.statusCode).toBe(200)
    expect(await totalLiveHours()).toBeCloseTo(1.5, 2)
  })

  it('adds the live time of a dangling session closed when a new stream connects', async () => {
    await openLiveBroadcast(HOUR_MS)

    const res = await app.inject({
      method: 'POST',
      url: '/internal/rtmp/on_publish',
      headers: form,
      payload: `name=${encodeURIComponent(STREAM_KEY)}`,
    })
    expect(res.statusCode).toBe(200)
    expect(await totalLiveHours()).toBeCloseTo(1, 2)
  })

  it('adds the live time of a session ended by forcing the channel offline', async () => {
    await openLiveBroadcast(3 * HOUR_MS)

    await forceChannelOffline(prisma, app.log, { channelId, slug: SLUG })
    expect(await totalLiveHours()).toBeCloseTo(3, 2)
  })

  it('does not count preview-only sessions or fallback placeholders', async () => {
    await prisma.broadcast.create({
      data: { channelId, source: 'ICECAST', startedAt: new Date(Date.now() - HOUR_MS) },
    })

    await app.inject({
      method: 'POST',
      url: '/internal/icecast/on_disconnect',
      headers: form,
      payload: `mount=/live/${SLUG}`,
    })
    expect(await totalLiveHours()).toBe(0)
  })

  it('counts a session once when it is ended twice', async () => {
    const broadcast = await openLiveBroadcast(HOUR_MS)

    const results = await Promise.all([
      endBroadcast(prisma, broadcast.id),
      endBroadcast(prisma, broadcast.id),
    ])
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await endBroadcast(prisma, broadcast.id)).toBe(false)
    expect(await totalLiveHours()).toBeCloseTo(1, 2)
  })

  it('backfills totals from ended broadcasts that went live', async () => {
    const end = new Date()
    await prisma.broadcast.createMany({
      data: [
        {
          channelId,
          source: 'RTMP',
          startedAt: new Date(end.getTime() - 3 * HOUR_MS),
          wentLiveAt: new Date(end.getTime() - 2 * HOUR_MS),
          endedAt: end,
        },
        {
          channelId,
          source: 'ICECAST',
          startedAt: new Date(end.getTime() - 5 * HOUR_MS),
          wentLiveAt: new Date(end.getTime() - 5 * HOUR_MS),
          endedAt: new Date(end.getTime() - 4.5 * HOUR_MS),
        },
        {
          channelId,
          source: 'ICECAST',
          startedAt: new Date(end.getTime() - 8 * HOUR_MS),
          endedAt: new Date(end.getTime() - 7 * HOUR_MS),
        },
      ],
    })

    const sql = await readFile(
      new URL(
        '../../../../../packages/db/prisma/migrations/20261003090000_backfill_channel_total_live_hours/migration.sql',
        import.meta.url,
      ),
      'utf8',
    )
    await prisma.$executeRawUnsafe(sql)

    expect(await totalLiveHours()).toBeCloseTo(2.5, 5)
  })
})
