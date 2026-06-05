// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { LiveFingerprintSegment } from '@tahti/shared'
import { broadcastFingerprintRedisKey } from '@tahti/shared'
import { getRedisClient } from './redis.js'

export type { LiveFingerprintSegment }

const TTL_SEC = 48 * 60 * 60
const MAX_SEGMENTS = 500

function redisKey(broadcastId: string): string {
  return broadcastFingerprintRedisKey(broadcastId)
}

export async function appendBroadcastFingerprintSegment(
  broadcastId: string,
  segment: Omit<LiveFingerprintSegment, 'capturedAt'>,
): Promise<void> {
  const client = await getRedisClient()
  if (!client) return

  const payload: LiveFingerprintSegment = {
    ...segment,
    capturedAt: new Date().toISOString(),
  }
  const key = redisKey(broadcastId)
  await client.rPush(key, JSON.stringify(payload))
  await client.lTrim(key, -MAX_SEGMENTS, -1)
  await client.expire(key, TTL_SEC)
}

export async function getBroadcastFingerprintSegments(
  broadcastId: string,
): Promise<LiveFingerprintSegment[]> {
  const client = await getRedisClient()
  if (!client) return []

  const rows = await client.lRange(redisKey(broadcastId), 0, -1)
  const segments: LiveFingerprintSegment[] = []
  for (const row of rows) {
    try {
      segments.push(JSON.parse(row) as LiveFingerprintSegment)
    } catch {
      // skip corrupt entries
    }
  }
  return segments
}

export async function clearBroadcastFingerprintSegments(broadcastId: string): Promise<void> {
  const client = await getRedisClient()
  if (!client) return
  await client.del(redisKey(broadcastId))
}
