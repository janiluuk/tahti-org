// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { createClient } from 'redis'
import {
  HLS_CADDY_LOG_OFFSET_KEY,
  HLS_EGRESS_REDIS_TTL_SEC,
  hlsEgressRedisKey,
} from '@tahti/shared'
import { readHlsCaddyLogFromOffset } from '../lib/hls-caddy-egress-log.js'

function redisUrl(): string {
  return process.env.REDIS_URL ?? 'redis://localhost:6379'
}

export async function processHlsCaddyEgressSyncJob(_job: Job): Promise<{
  lines: number
  bytes: number
}> {
  const logPath = process.env.CADDY_HLS_ACCESS_LOG ?? ''
  if (!logPath) return { lines: 0, bytes: 0 }

  const client = createClient({ url: redisUrl() })
  await client.connect()
  try {
    const offsetRaw = await client.get(HLS_CADDY_LOG_OFFSET_KEY)
    const offset = offsetRaw ? parseInt(offsetRaw, 10) : 0
    const { events, nextOffset } = await readHlsCaddyLogFromOffset(logPath, offset)

    let bytes = 0
    for (const ev of events) {
      bytes += ev.bytes
      const key = hlsEgressRedisKey(ev.slug, ev.utcDate)
      await client.incrBy(key, ev.bytes)
      await client.expire(key, HLS_EGRESS_REDIS_TTL_SEC)
    }

    if (nextOffset !== offset) {
      await client.set(HLS_CADDY_LOG_OFFSET_KEY, String(nextOffset))
    }

    return { lines: events.length, bytes }
  } finally {
    await client.quit().catch(() => undefined)
  }
}
