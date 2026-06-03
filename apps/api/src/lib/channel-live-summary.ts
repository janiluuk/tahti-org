// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { buildLiveDailySeries, LIVE_DAILY_SERIES_DAYS } from './channel-live-daily.js'

export type ChannelLiveStatsPayload = {
  windowDays: number
  totalLiveSeconds: number
  totalBroadcasts: number
  daily: Awaited<ReturnType<typeof buildLiveDailySeries>>
}

const empty: ChannelLiveStatsPayload = {
  windowDays: LIVE_DAILY_SERIES_DAYS,
  totalLiveSeconds: 0,
  totalBroadcasts: 0,
  daily: [],
}

export async function buildChannelLiveStats(
  prisma: PrismaClient,
  userId: string,
): Promise<ChannelLiveStatsPayload> {
  const channel = await prisma.channel.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!channel) return empty

  const daily = await buildLiveDailySeries(prisma, channel.id)
  return {
    windowDays: LIVE_DAILY_SERIES_DAYS,
    totalLiveSeconds: daily.reduce((s, d) => s + d.liveSeconds, 0),
    totalBroadcasts: daily.reduce((s, d) => s + d.broadcastCount, 0),
    daily,
  }
}
