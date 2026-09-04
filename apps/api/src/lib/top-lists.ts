// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient, Prisma } from '@tahti/db'
import { getCachedJson } from './json-cache.js'

const CACHE_TTL_SEC = 30

/** Buckets `since` to a fixed cache-key granularity — the underlying query
 * still uses the precise Date, this only controls how often the cache key
 * rotates (every CACHE_TTL_SEC, independent of exact request timing). */
function sinceBucketKey(since: Date | undefined): string {
  if (!since) return 'all'
  return String(Math.floor(since.getTime() / (CACHE_TTL_SEC * 1000)))
}

export type TopListPeriod = 'week' | 'month' | 'half_year' | 'all_time'

export function periodSince(period: TopListPeriod): Date | undefined {
  const DAY_MS = 86_400_000
  switch (period) {
    case 'week':
      return new Date(Date.now() - 7 * DAY_MS)
    case 'month':
      return new Date(Date.now() - 30 * DAY_MS)
    case 'half_year':
      return new Date(Date.now() - 182 * DAY_MS)
    case 'all_time':
      return undefined
  }
}

export interface TopListEntry {
  soundId: string
  listens: number
  title: string
  artistName: string
  channelSlug: string
  bannerUrl: string | null
  genre: string | null
  contentType: string
}

/** Ranks every eligible track with at least one listen in the window (most
 * listens first) — the shared base query behind both a single flat top list
 * and a dimension-bucketed breakdown, so both only ever cost two round-trips
 * (groupBy the raw counts, then one findMany to join the winning rows). */
async function rankedEntriesSince(
  prisma: PrismaClient,
  since: Date | undefined,
  extraWhere: Prisma.SoundWhereInput = {},
): Promise<TopListEntry[]> {
  const grouped = await prisma.listenEvent.groupBy({
    by: ['soundId'],
    where: {
      ...(since ? { playedAt: { gte: since } } : {}),
      sound: { isPublic: true, status: 'READY', topListsEligible: true, ...extraWhere },
    },
    _count: { _all: true },
  })
  if (grouped.length === 0) return []
  const countById = new Map(grouped.map((g) => [g.soundId, g._count._all]))

  const items = await prisma.sound.findMany({
    where: { id: { in: grouped.map((g) => g.soundId) } },
    select: {
      id: true,
      title: true,
      artistName: true,
      bannerUrl: true,
      genre: true,
      contentType: true,
      channel: { select: { slug: true, user: { select: { displayName: true } } } },
    },
  })

  return items
    .map((item) => ({
      soundId: item.id,
      listens: countById.get(item.id) ?? 0,
      title: item.title,
      artistName: item.artistName ?? item.channel.user.displayName,
      channelSlug: item.channel.slug,
      bannerUrl: item.bannerUrl,
      genre: item.genre,
      contentType: item.contentType,
    }))
    .sort((a, b) => b.listens - a.listens)
}

export async function buildTopList(
  prisma: PrismaClient,
  opts: {
    since?: Date
    contentTypes?: string[]
    genre?: string
    limit?: number
    /** 'asc' ranks least-listened first — still only among tracks with at
     * least one listen in the window, not the whole unplayed catalog. */
    sort?: 'desc' | 'asc'
  } = {},
): Promise<TopListEntry[]> {
  // Rankings don't need per-request freshness — a short cache collapses
  // every visitor hitting the same period/filter combination (the vast
  // majority of traffic, since the UI only offers a handful of presets)
  // into one groupBy+findMany instead of one per request.
  const key = `top-list:${sinceBucketKey(opts.since)}:${(opts.contentTypes ?? []).slice().sort().join(',')}:${opts.genre ?? ''}:${opts.sort ?? 'desc'}:${opts.limit ?? 20}`
  return getCachedJson(key, CACHE_TTL_SEC, async () => {
    const where: Prisma.SoundWhereInput = {}
    if (opts.contentTypes && opts.contentTypes.length > 0) {
      where.contentType = { in: opts.contentTypes as Prisma.EnumSoundContentTypeFilter['in'] }
    }
    if (opts.genre) where.genre = opts.genre
    const ranked = await rankedEntriesSince(prisma, opts.since, where)
    if (opts.sort === 'asc') ranked.reverse()
    return ranked.slice(0, opts.limit ?? 20)
  })
}

export interface TopListBucket {
  bucket: string
  entries: TopListEntry[]
}

/** Admin view: one ranked mini-list per content-type or per genre, ordered by
 * each bucket's own top entry so the busiest categories surface first. */
export async function buildTopListsByDimension(
  prisma: PrismaClient,
  opts: {
    since?: Date
    dimension: 'type' | 'genre'
    limitPerBucket?: number
    sort?: 'desc' | 'asc'
    userId?: string
  },
): Promise<TopListBucket[]> {
  const key = `top-list-dim:${sinceBucketKey(opts.since)}:${opts.dimension}:${opts.userId ?? ''}:${opts.sort ?? 'desc'}:${opts.limitPerBucket ?? 10}`
  return getCachedJson(key, CACHE_TTL_SEC, async () => {
    const ranked = await rankedEntriesSince(
      prisma,
      opts.since,
      opts.userId ? { channel: { userId: opts.userId } } : {},
    )
    if (opts.sort === 'asc') ranked.reverse()
    const buckets = new Map<string, TopListEntry[]>()
    for (const entry of ranked) {
      const key = opts.dimension === 'type' ? entry.contentType : (entry.genre ?? 'Unspecified')
      const list = buckets.get(key) ?? []
      list.push(entry)
      buckets.set(key, list)
    }
    return [...buckets.entries()]
      .map(([bucket, entries]) => ({
        bucket,
        entries: entries.slice(0, opts.limitPerBucket ?? 10),
      }))
      .sort((a, b) => (b.entries[0]?.listens ?? 0) - (a.entries[0]?.listens ?? 0))
  })
}

/** Best (lowest) 1-based rank for each requested track across the two lists
 * the public rank badge cares about — this month's top 50, and all-time's
 * top 50 — or undefined if it doesn't place in either. */
export async function rankLookup(
  prisma: PrismaClient,
  soundIds: string[],
): Promise<Map<string, number>> {
  if (soundIds.length === 0) return new Map()

  const [monthList, allTimeList] = await Promise.all([
    buildTopList(prisma, { since: periodSince('month'), limit: 50 }),
    buildTopList(prisma, { limit: 50 }),
  ])

  const best = new Map<string, number>()
  for (const list of [monthList, allTimeList]) {
    list.forEach((entry, i) => {
      if (!soundIds.includes(entry.soundId)) return
      const rank = i + 1
      const existing = best.get(entry.soundId)
      if (existing === undefined || rank < existing) best.set(entry.soundId, rank)
    })
  }
  return best
}
