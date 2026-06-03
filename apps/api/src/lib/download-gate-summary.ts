// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import { buildGateDailySeries, GATE_DAILY_SERIES_DAYS } from './download-gate-daily.js'

export type DownloadGateStatsPayload = {
  artistFollowerCount: number
  items: Array<{
    archiveItemId: string
    title: string
    repostToDownload: boolean
    followToDownload: boolean
    repostAckCount: number
    blockedDownloadAttempts: number
    countedDownloadCount: number
  }>
  totals: { repostAcks: number; blockedAttempts: number; countedDownloads: number }
  daily: Awaited<ReturnType<typeof buildGateDailySeries>>
}

const empty: DownloadGateStatsPayload = {
  artistFollowerCount: 0,
  items: [],
  totals: { repostAcks: 0, blockedAttempts: 0, countedDownloads: 0 },
  daily: [],
}

export async function buildDownloadGateStats(
  prisma: PrismaClient,
  userId: string,
): Promise<DownloadGateStatsPayload> {
  const channel = await prisma.channel.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!channel) return empty

  const gatedItems = await prisma.archiveItem.findMany({
    where: {
      channelId: channel.id,
      OR: [{ repostToDownload: true }, { followToDownload: true }],
    },
    select: { id: true, title: true, repostToDownload: true, followToDownload: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const itemIds = gatedItems.map((i) => i.id)
  const since = new Date(
    Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate() - (GATE_DAILY_SERIES_DAYS - 1),
    ),
  )

  const [repostByItem, blockedByItem, countedByItem, followerCount] = await Promise.all([
    itemIds.length > 0
      ? prisma.archiveRepostAck.groupBy({
          by: ['archiveItemId'],
          where: { archiveItemId: { in: itemIds } },
          _count: { _all: true },
        })
      : [],
    itemIds.length > 0
      ? prisma.download.groupBy({
          by: ['archiveItemId'],
          where: {
            archiveItemId: { in: itemIds },
            countedAt: null,
            reason: { in: ['gate_repost', 'gate_follow'] },
          },
          _count: { _all: true },
        })
      : [],
    itemIds.length > 0
      ? prisma.download.groupBy({
          by: ['archiveItemId'],
          where: {
            archiveItemId: { in: itemIds },
            countedAt: { not: null },
            createdAt: { gte: since },
          },
          _count: { _all: true },
        })
      : [],
    prisma.artistFollow.count({ where: { artistUserId: userId } }),
  ])

  const repostMap = new Map(repostByItem.map((r) => [r.archiveItemId, r._count._all]))
  const blockedMap = new Map(blockedByItem.map((b) => [b.archiveItemId, b._count._all]))
  const countedMap = new Map(countedByItem.map((c) => [c.archiveItemId, c._count._all]))

  const items = gatedItems.map((item) => ({
    archiveItemId: item.id,
    title: item.title,
    repostToDownload: item.repostToDownload,
    followToDownload: item.followToDownload,
    repostAckCount: repostMap.get(item.id) ?? 0,
    blockedDownloadAttempts: blockedMap.get(item.id) ?? 0,
    countedDownloadCount: countedMap.get(item.id) ?? 0,
  }))

  const daily = await buildGateDailySeries(prisma, channel.id)

  return {
    artistFollowerCount: followerCount,
    items,
    totals: {
      repostAcks: items.reduce((s, i) => s + i.repostAckCount, 0),
      blockedAttempts: items.reduce((s, i) => s + i.blockedDownloadAttempts, 0),
      countedDownloads: daily.reduce((s, d) => s + d.countedDownloads, 0),
    },
    daily,
  }
}
