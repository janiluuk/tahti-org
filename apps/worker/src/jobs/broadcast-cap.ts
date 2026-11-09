// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { endExpiredReconnectingBroadcasts } from '@tahti/shared/broadcast-end'
import {
  tickWeeklyLiveSeconds,
  enforceWeeklyCapDisconnects,
  resetFreeWeeklyLiveCounters,
} from '@tahti/shared/broadcast-cap'
import { stopOrchestratorChannel } from '../lib/orchestrator.js'
import { enqueueFinalizeBroadcastRecording } from '../lib/queue.js'

export async function processBroadcastCapTick(prisma: PrismaClient) {
  const ticked = await tickWeeklyLiveSeconds(prisma)
  const stoppedChannelIds = await enforceWeeklyCapDisconnects(prisma)
  for (const channelId of stoppedChannelIds) {
    await stopOrchestratorChannel(channelId)
  }
  return { ticked, stopped: stoppedChannelIds.length }
}

/** Ends LIVE shows whose encoder didn't reconnect within the grace period. */
export async function processBroadcastReconnectExpiry(prisma: PrismaClient) {
  const ended = await endExpiredReconnectingBroadcasts(prisma)
  let queued = 0
  for (const session of ended) {
    if (!session.autoRecordEnabled) continue
    await enqueueFinalizeBroadcastRecording(session.broadcastId)
    queued++
  }
  return { ended: ended.length, recordingsQueued: queued }
}

export async function processWeeklyBroadcastReset(prisma: PrismaClient) {
  const reset = await resetFreeWeeklyLiveCounters(prisma)
  return { reset }
}
