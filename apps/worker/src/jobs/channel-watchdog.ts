// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import type { PrismaClient } from '@tahti/db'
import { createClient } from 'redis'
import { hlsSegmentAgeSecFromFs, hlsSegmentAgeSecFromMinio } from '../lib/hls-segment-age.js'
import { broadcastSessionLogFields } from '@tahti/shared'
import { restartChannelLiquidsoap } from '../lib/orchestrator.js'

const STALE_SEC = parseInt(process.env.HLS_STALE_SECONDS ?? '20', 10)
const HLS_ROOT = process.env.HLS_SEGMENT_ROOT ?? ''
const HLS_BUCKET = process.env.HLS_MINIO_BUCKET ?? 'hls-live'
const RESTART_WINDOW_MS = 10 * 60 * 1000
const MAX_RESTARTS = 2

function redisUrl(): string {
  return process.env.REDIS_URL ?? 'redis://localhost:6379'
}

async function recordRestart(channelId: string): Promise<number> {
  const client = createClient({ url: redisUrl() })
  await client.connect()
  try {
    const key = `channel:watchdog:restarts:${channelId}`
    const now = Date.now()
    await client.zAdd(key, { score: now, value: String(now) })
    await client.zRemRangeByScore(key, 0, now - RESTART_WINDOW_MS)
    await client.expire(key, 900)
    return await client.zCard(key)
  } finally {
    await client.quit().catch(() => undefined)
  }
}

async function segmentAgeSec(channelId: string, slug: string): Promise<number | null> {
  if (HLS_ROOT) {
    const age = await hlsSegmentAgeSecFromFs(HLS_ROOT, channelId)
    if (age !== null) return age
  }
  return hlsSegmentAgeSecFromMinio(HLS_BUCKET, slug)
}

export async function processChannelWatchdogJob(
  prisma: PrismaClient,
  _job: Job,
): Promise<{ checked: number; restarted: number; skipped: number }> {
  const live = await prisma.channel.findMany({
    where: { state: 'LIVE' },
    select: {
      id: true,
      slug: true,
      broadcasts: {
        where: { endedAt: null },
        orderBy: { startedAt: 'desc' },
        take: 1,
        select: { id: true },
      },
      // Always-on curated channels (Tahti Selects) use the rotation template — no
      // live source ever connects, so this is the only signal that distinguishes them.
      curatedRotationItems: { select: { id: true }, take: 1 },
    },
  })

  let restarted = 0
  let skipped = 0

  for (const ch of live) {
    const broadcastId = ch.broadcasts[0]?.id
    if (!broadcastId) {
      skipped++
      continue
    }

    const age = await segmentAgeSec(ch.id, ch.slug)
    if (age === null) {
      skipped++
      continue
    }
    if (age <= STALE_SEC) continue

    const restartCount = await recordRestart(ch.id)
    if (restartCount > MAX_RESTARTS) {
      console.error(
        `[channel-watchdog] ${ch.slug}: segment stale ${age.toFixed(0)}s but restart cap hit (${restartCount} in 10m)`,
      )
      skipped++
      continue
    }

    try {
      const template = ch.curatedRotationItems.length > 0 ? 'rotation' : 'channel'
      await restartChannelLiquidsoap(ch.id, ch.slug, broadcastId, template)
      restarted++
      console.warn(
        JSON.stringify({
          ...broadcastSessionLogFields({
            broadcastId,
            channelId: ch.id,
            slug: ch.slug,
          }),
          segmentAgeSec: age,
          msg: 'liquidsoap restarted after stale HLS',
          component: 'channel-watchdog',
        }),
      )
    } catch (err) {
      console.error(`[channel-watchdog] restart failed for ${ch.slug}:`, err)
      skipped++
    }
  }

  return { checked: live.length, restarted, skipped }
}
