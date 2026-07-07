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

interface EgressDailyRow {
  day: Date
  bytes: bigint | null
  downloads: bigint
}

/**
 * PERF-005: SQL-side sum/count by day instead of pulling every Download row for the
 * window into Node and bucketing in a loop — a popular channel's 30-day download
 * history has no upper bound on row count. Prisma's groupBy can't truncate a
 * timestamp to a day, so this needs a raw query; DATE_TRUNC + GROUP BY does in one
 * index-backed aggregate what the old code did with an unbounded findMany.
 */
export async function buildEgressDailySeries(
  prisma: PrismaClient,
  channelId: string,
  days = EGRESS_DAILY_SERIES_DAYS,
): Promise<EgressDailyPoint[]> {
  const { since, keys } = utcDayKeys(days)

  const rows = await prisma.$queryRaw<EgressDailyRow[]>`
    SELECT
      DATE_TRUNC('day', "createdAt") AS day,
      SUM("bytes") AS bytes,
      COUNT(*) AS downloads
    FROM engagement."Download"
    WHERE "channelId" = ${channelId} AND "createdAt" >= ${since}
    GROUP BY DATE_TRUNC('day', "createdAt")
  `

  const bytesByDay = Object.fromEntries(keys.map((k) => [k, 0]))
  const countByDay = Object.fromEntries(keys.map((k) => [k, 0]))

  for (const row of rows) {
    const key = row.day.toISOString().slice(0, 10)
    if (!(key in bytesByDay)) continue
    bytesByDay[key] += Number(row.bytes ?? 0)
    countByDay[key] += Number(row.downloads)
  }

  return keys.map((date) => ({
    date,
    bytes: bytesByDay[date] ?? 0,
    downloads: countByDay[date] ?? 0,
  }))
}
