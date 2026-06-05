// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createClient } from 'redis'
import {
  broadcastFingerprintRedisKey,
  fingerprintsToTracklistEntries,
  type LiveFingerprintSegment,
} from '@tahti/shared'

function redisUrl(): string {
  return process.env.REDIS_URL ?? 'redis://localhost:6379'
}

export async function fetchBroadcastFingerprintSegments(
  broadcastId: string,
): Promise<LiveFingerprintSegment[]> {
  const client = createClient({ url: redisUrl() })
  await client.connect()
  try {
    const rows = await client.lRange(broadcastFingerprintRedisKey(broadcastId), 0, -1)
    const segments: LiveFingerprintSegment[] = []
    for (const row of rows) {
      try {
        segments.push(JSON.parse(row) as LiveFingerprintSegment)
      } catch {
        // skip corrupt entries
      }
    }
    return segments
  } finally {
    await client.disconnect()
  }
}

export async function clearBroadcastFingerprintSegments(broadcastId: string): Promise<void> {
  const client = createClient({ url: redisUrl() })
  await client.connect()
  try {
    await client.del(broadcastFingerprintRedisKey(broadcastId))
  } finally {
    await client.disconnect()
  }
}

export { fingerprintsToTracklistEntries }
