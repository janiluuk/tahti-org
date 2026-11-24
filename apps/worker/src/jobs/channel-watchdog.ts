// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import type { PrismaClient } from '@tahti/db'
import { createClient } from 'redis'
import { hlsSegmentAgeSecFromFs, hlsSegmentAgeSecFromMinio } from '../lib/hls-segment-age.js'
import { broadcastSessionLogFields, TAHTI_RADIO_SLUG, TAHTI_SELECTS_SLUG } from '@tahti/shared'
import { restartChannelLiquidsoap } from '../lib/orchestrator.js'
import { shutDownDeadAirChannel } from '../lib/dead-air.js'

const STALE_SEC = parseInt(process.env.HLS_STALE_SECONDS ?? '20', 10)
const HLS_ROOT = process.env.HLS_SEGMENT_ROOT ?? ''
const HLS_BUCKET = process.env.HLS_MINIO_BUCKET ?? 'hls-live'
const RESTART_WINDOW_MS = 10 * 60 * 1000
/** Artist channels: stop thrashing after this many restarts in the window. */
const MAX_RESTARTS = 2
/**
 * Always-on system channels (Tahti Radio / Selects) must never stay silent
 * because a short restart burst hit the artist cap. Keep trying, but not more
 * often than once per ALWAYS_ON_MIN_INTERVAL_MS after the soft burst.
 */
const ALWAYS_ON_MAX_BURST = parseInt(process.env.HLS_ALWAYS_ON_MAX_BURST ?? '6', 10)
const ALWAYS_ON_MIN_INTERVAL_MS =
  parseInt(process.env.HLS_ALWAYS_ON_RESTART_INTERVAL_SECONDS ?? '120', 10) * 1000
/** A broadcast this young may simply not have written its first segment yet. */
const MISSING_SEGMENTS_GRACE_MS =
  parseInt(process.env.HLS_MISSING_SEGMENTS_GRACE_SECONDS ?? '120', 10) * 1000

const ALWAYS_ON_SLUGS = new Set([TAHTI_RADIO_SLUG, TAHTI_SELECTS_SLUG])

function redisUrl(): string {
  return process.env.REDIS_URL ?? 'redis://localhost:6379'
}

function isAlwaysOn(slug: string): boolean {
  return ALWAYS_ON_SLUGS.has(slug)
}

async function recordRestart(channelId: string): Promise<{ count: number; lastMs: number }> {
  const client = createClient({ url: redisUrl() })
  await client.connect()
  try {
    const key = `channel:watchdog:restarts:${channelId}`
    const now = Date.now()
    await client.zAdd(key, { score: now, value: String(now) })
    await client.zRemRangeByScore(key, 0, now - RESTART_WINDOW_MS)
    await client.expire(key, 900)
    const count = await client.zCard(key)
    const newest = await client.zRangeWithScores(key, -1, -1)
    const lastMs = newest[0]?.score ?? now
    return { count, lastMs }
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

function shouldSkipRestart(
  slug: string,
  restartCount: number,
  lastRestartMs: number,
): { skip: boolean; reason?: string } {
  if (isAlwaysOn(slug)) {
    if (restartCount <= ALWAYS_ON_MAX_BURST) return { skip: false }
    const sinceLast = Date.now() - lastRestartMs
    if (sinceLast < ALWAYS_ON_MIN_INTERVAL_MS) {
      return {
        skip: true,
        reason: `always-on backoff (${Math.ceil((ALWAYS_ON_MIN_INTERVAL_MS - sinceLast) / 1000)}s left)`,
      }
    }
    return { skip: false }
  }
  if (restartCount > MAX_RESTARTS) {
    return { skip: true, reason: `restart cap hit (${restartCount} in 10m)` }
  }
  return { skip: false }
}

export async function processChannelWatchdogJob(
  prisma: PrismaClient,
  _job: Job,
): Promise<{ checked: number; restarted: number; skipped: number; shutDown: number }> {
  const live = await prisma.channel.findMany({
    where: { state: 'LIVE' },
    select: {
      id: true,
      slug: true,
      goneLiveAt: true,
      broadcasts: {
        where: { endedAt: null },
        orderBy: { startedAt: 'desc' },
        take: 1,
        select: { id: true, startedAt: true },
      },
      // Always-on curated channels (Tahti Selects) use the rotation template — no
      // live source ever connects, so this is the only signal that distinguishes them.
      curatedRotationItems: { select: { id: true }, take: 1 },
    },
  })

  let restarted = 0
  let skipped = 0
  let shutDown = 0

  for (const ch of live) {
    const broadcast = ch.broadcasts[0]
    if (!broadcast) {
      skipped++
      continue
    }
    const broadcastId = broadcast.id

    // No segments anywhere is the worst kind of stale, not "unknown": once a
    // channel's Liquidsoap container is gone nothing rewrites its HLS dir, and
    // hls-live-prune drops the last MinIO copies, so a dead channel ends up
    // here permanently while the API keeps reporting it LIVE.
    const age = await segmentAgeSec(ch.id, ch.slug)
    if (age === null) {
      if (Date.now() - broadcast.startedAt.getTime() < MISSING_SEGMENTS_GRACE_MS) {
        skipped++
        continue
      }
    } else if (age <= STALE_SEC) {
      continue
    }
    const ageLabel = age === null ? 'missing' : `${age.toFixed(0)}s`

    const { count: restartCount, lastMs } = await recordRestart(ch.id)
    const gate = shouldSkipRestart(ch.slug, restartCount, lastMs)
    if (gate.skip) {
      // A rotation / replay stream (nobody broadcasting: goneLiveAt unset) that
      // stays silent past the restart cap is dead air, so it comes off the
      // air. A human's live broadcast is never cut here.
      if (!isAlwaysOn(ch.slug) && ch.goneLiveAt === null) {
        try {
          await shutDownDeadAirChannel(prisma, {
            id: ch.id,
            slug: ch.slug,
            broadcastId,
            segmentAgeSec: age,
            restartCount,
          })
          shutDown++
        } catch (err) {
          console.error(`[channel-watchdog] dead-air shutdown failed for ${ch.slug}:`, err)
          skipped++
        }
        continue
      }
      console.error(`[channel-watchdog] ${ch.slug}: segment stale (${ageLabel}) but ${gate.reason}`)
      skipped++
      continue
    }

    try {
      const template =
        ch.slug === TAHTI_SELECTS_SLUG || ch.curatedRotationItems.length > 0
          ? 'rotation'
          : 'channel'
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
          alwaysOn: isAlwaysOn(ch.slug),
        }),
      )
    } catch (err) {
      console.error(`[channel-watchdog] restart failed for ${ch.slug}:`, err)
      skipped++
    }
  }

  return { checked: live.length, restarted, skipped, shutDown }
}
