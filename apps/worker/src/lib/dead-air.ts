// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { createClient } from 'redis'
import { broadcastSessionLogFields } from '@tahti/shared'
import { endBroadcast } from '@tahti/shared/broadcast-end'
import { stopOrchestratorChannel } from './orchestrator.js'

/**
 * How long a channel shut down for dead air stays off before the fallback
 * reconciler may start its rotation again. Long enough that a broken playlist
 * is not re-spawned every minute, short enough that a fixed one comes back.
 */
export const DEAD_AIR_COOLDOWN_SEC = parseInt(
  process.env.DEAD_AIR_COOLDOWN_SECONDS ?? String(6 * 60 * 60),
  10,
)

function redisUrl(): string {
  return process.env.REDIS_URL ?? 'redis://localhost:6379'
}

export function deadAirKey(channelId: string): string {
  return `channel:dead-air:${channelId}`
}

/** Channel ids that are still in their dead-air cooldown. */
export async function channelsInDeadAirCooldown(channelIds: string[]): Promise<Set<string>> {
  if (channelIds.length === 0) return new Set()
  const client = createClient({ url: redisUrl() })
  await client.connect()
  try {
    const flags = await client.mGet(channelIds.map(deadAirKey))
    return new Set(channelIds.filter((_, i) => flags[i] !== null))
  } finally {
    await client.quit().catch(() => undefined)
  }
}

export interface DeadAirChannel {
  id: string
  slug: string
  broadcastId: string | null
  segmentAgeSec: number | null
  restartCount: number
}

/**
 * Takes a replay / rotation stream that stays silent after the watchdog's
 * restarts off the air: stops its Liquidsoap container, ends the open
 * broadcast, sets the channel OFFLINE, starts the cooldown, and logs one
 * `dead air: stream shut down` entry with the evidence.
 */
export async function shutDownDeadAirChannel(
  prisma: PrismaClient,
  channel: DeadAirChannel,
): Promise<void> {
  await stopOrchestratorChannel(channel.id)
  if (channel.broadcastId) {
    await endBroadcast(prisma, channel.broadcastId)
  }
  await prisma.channel.update({
    where: { id: channel.id },
    data: { state: 'OFFLINE', goneLiveAt: null },
  })

  const client = createClient({ url: redisUrl() })
  await client.connect()
  try {
    await client.set(deadAirKey(channel.id), new Date().toISOString(), {
      EX: DEAD_AIR_COOLDOWN_SEC,
    })
  } finally {
    await client.quit().catch(() => undefined)
  }

  console.warn(
    JSON.stringify({
      ...(channel.broadcastId
        ? broadcastSessionLogFields({
            broadcastId: channel.broadcastId,
            channelId: channel.id,
            slug: channel.slug,
          })
        : { channelId: channel.id, slug: channel.slug }),
      component: 'channel-watchdog',
      msg: 'dead air: stream shut down',
      reason: 'dead-air',
      segmentAgeSec: channel.segmentAgeSec,
      restartsInWindow: channel.restartCount,
      cooldownSec: DEAD_AIR_COOLDOWN_SEC,
    }),
  )
}
