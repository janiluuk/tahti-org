// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

export const EGRESS_DAILY_SERIES_DAYS = 30

export interface EgressDailyPoint {
  date: string
  bytes: number
  downloads: number
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

/** STREAM-006: last N UTC days of attributed download egress per channel. */
export async function buildEgressDailySeries(
  prisma: PrismaClient,
  channelId: string,
  days = EGRESS_DAILY_SERIES_DAYS,
): Promise<EgressDailyPoint[]> {
  const { since, keys } = utcDayKeys(days)

  const rows = await prisma.download.findMany({
    where: { channelId, createdAt: { gte: since } },
    select: { createdAt: true, bytes: true },
  })

  const bytesByDay = Object.fromEntries(keys.map((k) => [k, 0]))
  const countByDay = Object.fromEntries(keys.map((k) => [k, 0]))

  for (const row of rows) {
    const key = row.createdAt.toISOString().slice(0, 10)
    if (!(key in bytesByDay)) continue
    bytesByDay[key] += row.bytes
    countByDay[key]++
  }

  return keys.map((date) => ({
    date,
    bytes: bytesByDay[date] ?? 0,
    downloads: countByDay[date] ?? 0,
  }))
}
