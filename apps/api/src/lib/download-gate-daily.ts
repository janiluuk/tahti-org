// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

export const GATE_DAILY_SERIES_DAYS = 14

export interface GateDailyPoint {
  date: string
  repostAcks: number
  blockedAttempts: number
  countedDownloads: number
}

function utcDayKeys(days: number): { since: Date; keys: string[] } {
  const keys: string[] = []
  const now = new Date()
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)),
  )
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    keys.push(d.toISOString().slice(0, 10))
  }
  return { since: start, keys }
}

function bucketByUtcDay(rows: { createdAt: Date }[], keys: string[]): Record<string, number> {
  const counts = Object.fromEntries(keys.map((k) => [k, 0]))
  for (const row of rows) {
    const key = row.createdAt.toISOString().slice(0, 10)
    if (key in counts) counts[key]++
  }
  return counts
}

/** M22: last N UTC days of gate funnel activity for dashboard sparklines. */
export async function buildGateDailySeries(
  prisma: PrismaClient,
  channelId: string,
  days = GATE_DAILY_SERIES_DAYS,
): Promise<GateDailyPoint[]> {
  const { since, keys } = utcDayKeys(days)

  const channelItems = await prisma.archiveItem.findMany({
    where: { channelId },
    select: { id: true },
  })
  const archiveItemIds = channelItems.map((i) => i.id)

  const [repostRows, blockedRows, countedRows] = await Promise.all([
    archiveItemIds.length > 0
      ? prisma.archiveRepostAck.findMany({
          where: { archiveItemId: { in: archiveItemIds }, createdAt: { gte: since } },
          select: { createdAt: true },
        })
      : [],
    prisma.download.findMany({
      where: {
        channelId,
        createdAt: { gte: since },
        countedAt: null,
        reason: { in: ['gate_repost', 'gate_follow'] },
      },
      select: { createdAt: true },
    }),
    prisma.download.findMany({
      where: { channelId, createdAt: { gte: since }, countedAt: { not: null } },
      select: { createdAt: true },
    }),
  ])

  const repost = bucketByUtcDay(repostRows, keys)
  const blocked = bucketByUtcDay(blockedRows, keys)
  const counted = bucketByUtcDay(countedRows, keys)

  return keys.map((date) => ({
    date,
    repostAcks: repost[date] ?? 0,
    blockedAttempts: blocked[date] ?? 0,
    countedDownloads: counted[date] ?? 0,
  }))
}
