// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import {
  buildLiveDailySeries,
  LIVE_DAILY_SERIES_DAYS,
  type LiveDailyPoint,
} from './channel-live-daily.js'
import { fetchMeasuredHlsListenersByDate } from './hls-egress-measured.js'

export interface ChannelLiveDailyPoint extends LiveDailyPoint {
  /** Distinct anonymized HLS listeners measured from Caddy access logs; 0 when unavailable. */
  listeners: number
}

export type ChannelLiveStatsPayload = {
  windowDays: number
  totalLiveSeconds: number
  totalBroadcasts: number
  /** Best single-day distinct-listener count across the window — avoids double-counting returning listeners. */
  peakDailyListeners: number
  daily: ChannelLiveDailyPoint[]
}

const empty: ChannelLiveStatsPayload = {
  windowDays: LIVE_DAILY_SERIES_DAYS,
  totalLiveSeconds: 0,
  totalBroadcasts: 0,
  peakDailyListeners: 0,
  daily: [],
}

export async function buildChannelLiveStats(
  prisma: PrismaClient,
  userId: string,
): Promise<ChannelLiveStatsPayload> {
  const channel = await prisma.channel.findUnique({
    where: { userId },
    select: { id: true, slug: true },
  })
  if (!channel) return empty

  const dbDaily = await buildLiveDailySeries(prisma, channel.id)
  const listenersByDate = await fetchMeasuredHlsListenersByDate(
    channel.slug,
    dbDaily.map((d) => d.date),
  )
  const daily = dbDaily.map((d) => ({ ...d, listeners: listenersByDate[d.date] ?? 0 }))

  return {
    windowDays: LIVE_DAILY_SERIES_DAYS,
    totalLiveSeconds: daily.reduce((s, d) => s + d.liveSeconds, 0),
    totalBroadcasts: daily.reduce((s, d) => s + d.broadcastCount, 0),
    peakDailyListeners: Math.max(0, ...daily.map((d) => d.listeners)),
    daily,
  }
}
