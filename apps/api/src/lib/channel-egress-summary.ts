// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { buildEgressDailySeries, EGRESS_DAILY_SERIES_DAYS } from './channel-egress-daily.js'
import { buildLiveDailySeries } from './channel-live-daily.js'
import {
  estimateLiveHlsBytes,
  LIVE_HLS_ESTIMATE_NOTE,
  LIVE_HLS_MEASURED_NOTE,
} from './hls-egress-estimate.js'
import { fetchMeasuredHlsEgressByDate } from './hls-egress-measured.js'

export type ChannelEgressPayload = {
  windowDays: number
  totalBytes: number
  downloadBytes: number
  liveHlsBytes: number
  estimatedLiveHlsBytes: number
  totalDownloads: number
  daily: Array<{
    date: string
    bytes: number
    downloadBytes: number
    liveHlsBytes: number
    estimatedLiveBytes: number
    downloads: number
  }>
  liveEstimateNote: string
}

const empty: ChannelEgressPayload = {
  windowDays: EGRESS_DAILY_SERIES_DAYS,
  totalBytes: 0,
  downloadBytes: 0,
  liveHlsBytes: 0,
  estimatedLiveHlsBytes: 0,
  totalDownloads: 0,
  daily: [],
  liveEstimateNote: LIVE_HLS_ESTIMATE_NOTE,
}

function effectiveLiveBytes(measured: number, estimated: number): number {
  return measured > 0 ? measured : estimated
}

export async function buildChannelEgressStats(
  prisma: PrismaClient,
  userId: string,
): Promise<ChannelEgressPayload> {
  const channel = await prisma.channel.findUnique({
    where: { userId },
    select: {
      id: true,
      slug: true,
      user: { select: { tier: true } },
    },
  })
  if (!channel) return empty

  const since = new Date(
    Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate() - (EGRESS_DAILY_SERIES_DAYS - 1),
    ),
  )

  const [agg, downloadDaily, liveDaily] = await Promise.all([
    prisma.download.aggregate({
      where: { channelId: channel.id, createdAt: { gte: since } },
      _sum: { bytes: true },
      _count: { _all: true },
    }),
    buildEgressDailySeries(prisma, channel.id),
    buildLiveDailySeries(prisma, channel.id, EGRESS_DAILY_SERIES_DAYS),
  ])

  const dates = downloadDaily.map((d) => d.date)
  const measuredByDate = await fetchMeasuredHlsEgressByDate(channel.slug, dates)
  const liveByDate = Object.fromEntries(liveDaily.map((d) => [d.date, d.liveSeconds]))
  const tier = channel.user.tier

  let liveHlsBytes = 0
  let estimatedLiveHlsBytes = 0
  let hasMeasured = false

  const daily = downloadDaily.map((d) => {
    const liveSeconds = liveByDate[d.date] ?? 0
    const estimatedLiveBytes = estimateLiveHlsBytes(liveSeconds, tier)
    const dayMeasured = measuredByDate[d.date] ?? 0
    if (dayMeasured > 0) hasMeasured = true
    const liveBytes = effectiveLiveBytes(dayMeasured, estimatedLiveBytes)
    liveHlsBytes += dayMeasured
    estimatedLiveHlsBytes += estimatedLiveBytes
    return {
      date: d.date,
      downloadBytes: d.bytes,
      liveHlsBytes: dayMeasured,
      estimatedLiveBytes,
      bytes: d.bytes + liveBytes,
      downloads: d.downloads,
    }
  })

  const downloadBytes = agg._sum.bytes ?? 0
  const effectiveLiveTotal = daily.reduce(
    (sum, d) => sum + effectiveLiveBytes(d.liveHlsBytes, d.estimatedLiveBytes),
    0,
  )

  return {
    windowDays: EGRESS_DAILY_SERIES_DAYS,
    downloadBytes,
    liveHlsBytes,
    estimatedLiveHlsBytes,
    totalBytes: downloadBytes + effectiveLiveTotal,
    totalDownloads: agg._count._all,
    daily,
    liveEstimateNote: hasMeasured ? LIVE_HLS_MEASURED_NOTE : LIVE_HLS_ESTIMATE_NOTE,
  }
}
