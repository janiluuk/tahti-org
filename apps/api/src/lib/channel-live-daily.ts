// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

export const LIVE_DAILY_SERIES_DAYS = 14

export interface LiveDailyPoint {
  date: string
  liveSeconds: number
  broadcastCount: number
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

function allocateBroadcastSeconds(
  startedAt: Date,
  endedAt: Date,
  keys: string[],
): { seconds: Record<string, number>; counts: Record<string, number> } {
  const seconds = Object.fromEntries(keys.map((k) => [k, 0]))
  const counts = Object.fromEntries(keys.map((k) => [k, 0]))
  const startMs = startedAt.getTime()
  const endMs = endedAt.getTime()
  if (endMs <= startMs) return { seconds, counts }

  for (const key of keys) {
    const dayStart = Date.parse(`${key}T00:00:00.000Z`)
    const dayEnd = dayStart + 86_400_000
    const overlapStart = Math.max(startMs, dayStart)
    const overlapEnd = Math.min(endMs, dayEnd)
    if (overlapEnd > overlapStart) {
      seconds[key] += Math.floor((overlapEnd - overlapStart) / 1000)
      counts[key]++
    }
  }
  return { seconds, counts }
}

/** M22: live broadcast duration per UTC day (proxy for listener funnel until HLS metrics exist). */
export async function buildLiveDailySeries(
  prisma: PrismaClient,
  channelId: string,
  days = LIVE_DAILY_SERIES_DAYS,
): Promise<LiveDailyPoint[]> {
  const { since, keys } = utcDayKeys(days)

  const broadcasts = await prisma.broadcast.findMany({
    where: { channelId, startedAt: { gte: since }, endedAt: { not: null } },
    select: { startedAt: true, endedAt: true },
  })

  const liveSeconds = Object.fromEntries(keys.map((k) => [k, 0]))
  const broadcastCount = Object.fromEntries(keys.map((k) => [k, 0]))

  for (const b of broadcasts) {
    const { seconds, counts } = allocateBroadcastSeconds(b.startedAt, b.endedAt!, keys)
    for (const key of keys) {
      liveSeconds[key] += seconds[key] ?? 0
      broadcastCount[key] += counts[key] ?? 0
    }
  }

  return keys.map((date) => ({
    date,
    liveSeconds: liveSeconds[date] ?? 0,
    broadcastCount: broadcastCount[date] ?? 0,
  }))
}
