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
  /** The artist's own listening (signed in to their account) is left out,
   * like their own plays in the play counts. */
  excludeUserId?: string
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
    ...(window.excludeUserId
      ? { OR: [{ byUserId: null }, { byUserId: { not: window.excludeUserId } }] }
      : {}),
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
  surface: 'source',
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

/** Listener countries and cities as shares of all listens in the window.
 * Countries are named by ISO code; a city is only named once enough
 * listens share it, and cities the database doesn't know are left out. */
export async function buildLocationShares(
  prisma: PrismaClient,
  channelId: string,
  window: AudienceWindow,
) {
  const where = audienceWhere(channelId, window)
  const [countryRows, cityRows] = await Promise.all([
    prisma.listenSession.groupBy({ by: ['countryCode'], where, _count: { _all: true } }),
    prisma.listenSession.groupBy({
      by: ['countryCode', 'city'],
      where: { ...where, city: { not: null } },
      _count: { _all: true },
    }),
  ])
  const countries = toShares(
    countryRows.map((row) => ({ name: row.countryCode ?? 'Unknown', count: row._count._all })),
  )
  const total = countries.total
  const share = (count: number) => (total > 0 ? Math.round((count / total) * 10_000) / 10_000 : 0)
  const cities = cityRows
    .filter((row) => row._count._all >= AUDIENCE_MIN_BUCKET)
    .map((row) => ({
      name: row.city!,
      countryCode: row.countryCode,
      count: row._count._all,
      share: share(row._count._all),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  return {
    total,
    countries: countries.items.map((item) => ({
      ...item,
      countryCode: item.name === AUDIENCE_OTHER || item.name === 'Unknown' ? null : item.name,
    })),
    cities,
  }
}

const LOYALTY_SAMPLE_LIMIT = 50_000

/** Drop-off curve for on-demand listens: for 0, 10 … 100 % of a track, the
 * share of listens that got at least that far. Empty until enough listens
 * report a position. */
export async function buildLoyaltyCurve(
  prisma: PrismaClient,
  channelId: string,
  window: AudienceWindow,
) {
  const rows = await prisma.listenSession.findMany({
    where: {
      ...audienceWhere(channelId, window),
      soundId: window.soundId ?? { not: null },
      maxPositionSec: { not: null },
      durationSec: { gt: 0 },
    },
    select: { maxPositionSec: true, durationSec: true },
    orderBy: { startedAt: 'desc' },
    take: LOYALTY_SAMPLE_LIMIT,
  })
  const total = rows.length
  if (total < AUDIENCE_MIN_BUCKET) return { total, points: [] }
  const reachedTenths = rows.map((row) =>
    Math.min(10, Math.floor((10 * row.maxPositionSec!) / row.durationSec!)),
  )
  const points = Array.from({ length: 11 }, (_, tenth) => {
    const reached = reachedTenths.filter((value) => value >= tenth).length
    return { percent: tenth * 10, share: Math.round((reached / total) * 10_000) / 10_000 }
  })
  return { total, points }
}

const LISTENING_SAMPLE_LIMIT = 200_000

/** Listens and minutes listened in the window. A session lasts from its
 * first to its last heartbeat (3 minutes apart), or as far as its track
 * played when that is longer, so a short listen still counts. */
export async function buildListeningTime(
  prisma: PrismaClient,
  channelId: string,
  window: AudienceWindow,
) {
  const rows = await prisma.listenSession.findMany({
    where: audienceWhere(channelId, window),
    select: { startedAt: true, lastSeenAt: true, maxPositionSec: true },
    take: LISTENING_SAMPLE_LIMIT,
  })
  const seconds = rows.reduce((sum, row) => {
    const span = Math.max(0, (row.lastSeenAt.getTime() - row.startedAt.getTime()) / 1000)
    return sum + Math.max(span, row.maxPositionSec ?? 0)
  }, 0)
  const minutes = Math.round(seconds / 60)
  return {
    listens: rows.length,
    minutes,
    averageMinutes: rows.length > 0 ? Math.round((seconds / 60 / rows.length) * 10) / 10 : 0,
  }
}
