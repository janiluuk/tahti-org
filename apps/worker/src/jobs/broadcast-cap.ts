// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import {
  tickWeeklyLiveSeconds,
  enforceWeeklyCapDisconnects,
  resetFreeWeeklyLiveCounters,
} from '@tahti/shared/broadcast-cap'
import { stopOrchestratorChannel } from '../lib/orchestrator.js'

export async function processBroadcastCapTick(prisma: PrismaClient) {
  const ticked = await tickWeeklyLiveSeconds(prisma)
  const stoppedChannelIds = await enforceWeeklyCapDisconnects(prisma)
  for (const channelId of stoppedChannelIds) {
    await stopOrchestratorChannel(channelId)
  }
  return { ticked, stopped: stoppedChannelIds.length }
}

export async function processWeeklyBroadcastReset(prisma: PrismaClient) {
  const reset = await resetFreeWeeklyLiveCounters(prisma)
  return { reset }
}
