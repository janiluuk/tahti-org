// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// The Discord radio bot has no inbound HTTP port (pure outbound gateway
// client), so liveness works the other way around: it self-reports into this
// Redis hash on an interval, and readDiscordBotHeartbeat()'s caller compares
// `updatedAt` against ONLINE_THRESHOLD_MS to decide up/down. There is exactly
// one bot replica (a second one would join Discord twice), so a single hash
// key is enough — no fleet to enumerate like apps/worker/src/lib/worker-registry.ts.

import { getRedisClient } from './redis.js'

const KEY = 'discord-bot:heartbeat'

export interface DiscordBotHeartbeat {
  guildCount: number
  uptimeSecs: number
  currentTrack: string | null
  updatedAt: number
}

export async function recordDiscordBotHeartbeat(
  input: Omit<DiscordBotHeartbeat, 'updatedAt'>,
): Promise<void> {
  const client = await getRedisClient()
  if (!client) return
  await client.hSet(KEY, {
    guildCount: String(input.guildCount),
    uptimeSecs: String(input.uptimeSecs),
    currentTrack: input.currentTrack ?? '',
    updatedAt: String(Date.now()),
  })
}

export async function readDiscordBotHeartbeat(): Promise<DiscordBotHeartbeat | null> {
  const client = await getRedisClient()
  if (!client) return null
  const hash = await client.hGetAll(KEY)
  if (!hash.updatedAt) return null
  return {
    guildCount: Number(hash.guildCount ?? 0),
    uptimeSecs: Number(hash.uptimeSecs ?? 0),
    currentTrack: hash.currentTrack || null,
    updatedAt: Number(hash.updatedAt),
  }
}

/** Pure staleness check, split out from Redis I/O so it's unit-testable in isolation. */
export function isHeartbeatStale(updatedAt: number, now: number, thresholdMs: number): boolean {
  return now - updatedAt > thresholdMs
}
