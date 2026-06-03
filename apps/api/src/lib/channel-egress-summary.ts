// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { buildEgressDailySeries, EGRESS_DAILY_SERIES_DAYS } from './channel-egress-daily.js'

export type ChannelEgressPayload = {
  windowDays: number
  totalBytes: number
  totalDownloads: number
  daily: Awaited<ReturnType<typeof buildEgressDailySeries>>
}

const empty: ChannelEgressPayload = {
  windowDays: EGRESS_DAILY_SERIES_DAYS,
  totalBytes: 0,
  totalDownloads: 0,
  daily: [],
}

export async function buildChannelEgressStats(
  prisma: PrismaClient,
  userId: string,
): Promise<ChannelEgressPayload> {
  const channel = await prisma.channel.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!channel) return empty

  const since = new Date(
    Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate() - (EGRESS_DAILY_SERIES_DAYS - 1),
    ),
  )

  const [agg, daily] = await Promise.all([
    prisma.download.aggregate({
      where: { channelId: channel.id, createdAt: { gte: since } },
      _sum: { bytes: true },
      _count: { _all: true },
    }),
    buildEgressDailySeries(prisma, channel.id),
  ])

  return {
    windowDays: EGRESS_DAILY_SERIES_DAYS,
    totalBytes: agg._sum.bytes ?? 0,
    totalDownloads: agg._count._all,
    daily,
  }
}
