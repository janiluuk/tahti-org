// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Prisma, PrismaClient } from '@tahti/db'
import type { StatsAudienceDimension, StatsShareItem } from '@tahti/shared'

/** A name is only shown once this many listens share it; the rest fold
 * into "Other", so a small artist's stats never single out one listener. */
export const AUDIENCE_MIN_BUCKET = 5

export const AUDIENCE_OTHER = 'Other'

export interface AudienceWindow {
  range: '1' | '7' | '30' | 'all'
  from?: string
  to?: string
  soundId?: string
  includeBots: boolean
}

function startedAtFilter(window: AudienceWindow): Prisma.DateTimeFilter | undefined {
  if (window.from && window.to) {
    return {
      gte: new Date(`${window.from}T00:00:00.000Z`),
      lte: new Date(`${window.to}T23:59:59.999Z`),
    }
  }
  if (window.range === 'all') return undefined
  const days = Number(window.range)
  const now = new Date()
  return {
    gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1))),
  }
}

/** The ListenSession filter for one artist's channel and window. */
export function audienceWhere(
  channelId: string,
  window: AudienceWindow,
): Prisma.ListenSessionWhereInput {
  const startedAt = startedAtFilter(window)
  return {
    channelId,
    ...(window.soundId ? { soundId: window.soundId } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(window.includeBots ? {} : { isBot: false }),
  }
}

/** Counts per name → shares, smallest names folded into "Other". */
export function toShares(
  counts: { name: string; count: number }[],
  minBucket = AUDIENCE_MIN_BUCKET,
): { total: number; items: StatsShareItem[] } {
  const total = counts.reduce((sum, row) => sum + row.count, 0)
  const merged = new Map<string, number>()
  let other = 0
  for (const row of counts) {
    if (row.count < minBucket || row.name === AUDIENCE_OTHER) {
      other += row.count
    } else {
      merged.set(row.name, (merged.get(row.name) ?? 0) + row.count)
    }
  }
  const share = (count: number) => (total > 0 ? Math.round((count / total) * 10_000) / 10_000 : 0)
  const items = [...merged]
    .map(([name, count]) => ({ name, count, share: share(count) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  if (other > 0) items.push({ name: AUDIENCE_OTHER, count: other, share: share(other) })
  return { total, items }
}

const COLUMN = {
  browser: 'uaBrowser',
  os: 'uaOs',
  deviceType: 'uaDeviceType',
  deviceVendor: 'uaDeviceVendor',
  source: 'referrerHost',
} as const satisfies Record<StatsAudienceDimension, keyof Prisma.ListenSessionGroupByOutputType>

export async function buildAudienceShares(
  prisma: PrismaClient,
  channelId: string,
  dimension: StatsAudienceDimension,
  window: AudienceWindow,
) {
  const column = COLUMN[dimension]
  const rows = await prisma.listenSession.groupBy({
    by: [column],
    where: audienceWhere(channelId, window),
    _count: { _all: true },
  })
  const fallback = dimension === 'source' ? 'Direct' : 'Unknown'
  const counts = rows.map((row) => ({
    name: (row[column] as string | null) ?? fallback,
    count: row._count._all,
  }))
  return toShares(counts)
}
