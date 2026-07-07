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

interface DailyCountRow {
  day: Date
  count: bigint
}

function bucketRows(rows: DailyCountRow[], keys: string[]): Record<string, number> {
  const counts = Object.fromEntries(keys.map((k) => [k, 0]))
  for (const row of rows) {
    const key = row.day.toISOString().slice(0, 10)
    if (key in counts) counts[key] = Number(row.count)
  }
  return counts
}

/**
 * PERF-005: SQL-side count-by-day instead of pulling every matching row (plus,
 * previously, *every archive item the channel owns* just to get IDs for an `in:`
 * filter) into Node to bucket in a loop. Same DATE_TRUNC approach as
 * buildEgressDailySeries — Prisma groupBy can't truncate a timestamp to a day, so
 * this needs a raw query. The repost-ack join replaces the old two-step
 * findMany-then-findMany(in:) with one query.
 */
export async function buildGateDailySeries(
  prisma: PrismaClient,
  channelId: string,
  days = GATE_DAILY_SERIES_DAYS,
): Promise<GateDailyPoint[]> {
  const { since, keys } = utcDayKeys(days)

  const [repostRows, blockedRows, countedRows] = await Promise.all([
    prisma.$queryRaw<DailyCountRow[]>`
      SELECT DATE_TRUNC('day', ra."createdAt") AS day, COUNT(*) AS count
      FROM engagement."ArchiveRepostAck" ra
      JOIN channel."ArchiveItem" ai ON ai.id = ra."archiveItemId"
      WHERE ai."channelId" = ${channelId} AND ra."createdAt" >= ${since}
      GROUP BY DATE_TRUNC('day', ra."createdAt")
    `,
    prisma.$queryRaw<DailyCountRow[]>`
      SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*) AS count
      FROM engagement."Download"
      WHERE "channelId" = ${channelId}
        AND "createdAt" >= ${since}
        AND "countedAt" IS NULL
        AND "reason" IN ('gate_repost', 'gate_follow')
      GROUP BY DATE_TRUNC('day', "createdAt")
    `,
    prisma.$queryRaw<DailyCountRow[]>`
      SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*) AS count
      FROM engagement."Download"
      WHERE "channelId" = ${channelId} AND "createdAt" >= ${since} AND "countedAt" IS NOT NULL
      GROUP BY DATE_TRUNC('day', "createdAt")
    `,
  ])

  const repost = bucketRows(repostRows, keys)
  const blocked = bucketRows(blockedRows, keys)
  const counted = bucketRows(countedRows, keys)

  return keys.map((date) => ({
    date,
    repostAcks: repost[date] ?? 0,
    blockedAttempts: blocked[date] ?? 0,
    countedDownloads: counted[date] ?? 0,
  }))
}
