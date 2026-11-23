// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient, Prisma } from '@tahti/db'
import { getCachedJson } from './json-cache.js'
import { listedArtistSoundWhere } from './listed-artist.js'
import { trackArtistName } from './safe-names.js'

const SHORT_CACHE_TTL_SEC = 30
const LONG_CACHE_TTL_SEC = 600
const LONG_WINDOW_MS = 8 * 86_400_000

/** Month, half-year and all-time rankings barely move between requests, so
 * they are cached longer than the week window. */
function cacheTtlSec(since: Date | undefined): number {
  if (!since || Date.now() - since.getTime() > LONG_WINDOW_MS) return LONG_CACHE_TTL_SEC
  return SHORT_CACHE_TTL_SEC
}

/** Buckets `since` to a fixed cache-key granularity — the underlying query
 * still uses the precise Date, this only controls how often the cache key
 * rotates (every `ttlSec`, independent of exact request timing). */
function sinceBucketKey(since: Date | undefined, ttlSec: number): string {
  if (!since) return 'all'
  return String(Math.floor(since.getTime() / (ttlSec * 1000)))
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
  /** The channel owner's avatar when they are the credited artist. */
  artistAvatarUrl: string | null
  channelSlug: string
  bannerUrl: string | null
  genre: string | null
  contentType: string
}

const topListSoundSelect = {
  id: true,
  title: true,
  artistName: true,
  bannerUrl: true,
  genre: true,
  contentType: true,
  channel: {
    select: {
      slug: true,
      user: { select: { username: true, displayName: true, avatarUrl: true } },
    },
  },
} as const

function rankedListenWhere(
  since: Date | undefined,
  extraWhere: Prisma.SoundWhereInput,
): Prisma.ListenEventWhereInput {
  return {
    ...(since ? { playedAt: { gte: since } } : {}),
    sound: {
      isPublic: true,
      status: 'READY',
      topListsEligible: true,
      ...listedArtistSoundWhere,
      ...extraWhere,
    },
  }
}

/** Joins the display rows for already-counted tracks, keeping only the ones
 * still found, ordered by listens and then sound id. */
async function toEntries(
  prisma: PrismaClient,
  counted: Array<{ soundId: string; listens: number }>,
  sort: 'desc' | 'asc',
): Promise<TopListEntry[]> {
  if (counted.length === 0) return []
  const countById = new Map(counted.map((c) => [c.soundId, c.listens]))
  const items = await prisma.sound.findMany({
    where: { id: { in: counted.map((c) => c.soundId) } },
    select: topListSoundSelect,
  })
  const direction = sort === 'asc' ? 1 : -1
  return items
    .map((item) => ({
      soundId: item.id,
      listens: countById.get(item.id) ?? 0,
      title: item.title,
      artistName: trackArtistName(item),
      artistAvatarUrl: item.artistName ? null : item.channel.user.avatarUrl,
      channelSlug: item.channel.slug,
      bannerUrl: item.bannerUrl,
      genre: item.genre,
      contentType: item.contentType,
    }))
    .sort((a, b) => direction * (a.listens - b.listens) || (a.soundId < b.soundId ? -1 : 1))
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
  const ttlSec = cacheTtlSec(opts.since)
  const sort = opts.sort ?? 'desc'
  const limit = opts.limit ?? 20
  const key = `top-list:${sinceBucketKey(opts.since, ttlSec)}:${(opts.contentTypes ?? []).slice().sort().join(',')}:${opts.genre ?? ''}:${sort}:${limit}`
  return getCachedJson(key, ttlSec, async () => {
    const where: Prisma.SoundWhereInput = {}
    if (opts.contentTypes && opts.contentTypes.length > 0) {
      where.contentType = { in: opts.contentTypes as Prisma.EnumSoundContentTypeFilter['in'] }
    }
    if (opts.genre) where.genre = opts.genre
    const grouped = await prisma.listenEvent.groupBy({
      by: ['soundId'],
      where: rankedListenWhere(opts.since, where),
      _count: { soundId: true },
      orderBy: [{ _count: { soundId: sort } }, { soundId: 'asc' }],
      take: limit,
    })
    return toEntries(
      prisma,
      grouped.map((g) => ({ soundId: g.soundId, listens: g._count.soundId })),
      sort,
    )
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
  const ttlSec = SHORT_CACHE_TTL_SEC
  const sort = opts.sort ?? 'desc'
  const limitPerBucket = opts.limitPerBucket ?? 10
  const key = `top-list-dim:${sinceBucketKey(opts.since, ttlSec)}:${opts.dimension}:${opts.userId ?? ''}:${sort}:${limitPerBucket}`
  return getCachedJson(key, ttlSec, async () => {
    const grouped = await prisma.listenEvent.groupBy({
      by: ['soundId'],
      where: rankedListenWhere(opts.since, opts.userId ? { channel: { userId: opts.userId } } : {}),
      _count: { _all: true },
    })
    if (grouped.length === 0) return []
    const countById = new Map(grouped.map((g) => [g.soundId, g._count._all]))

    // Bucket on the two dimension columns only, then load display rows for
    // the per-bucket winners instead of every ranked track.
    const dims = await prisma.sound.findMany({
      where: { id: { in: grouped.map((g) => g.soundId) } },
      select: { id: true, genre: true, contentType: true },
    })
    const direction = sort === 'asc' ? 1 : -1
    const ranked = dims
      .map((d) => ({ ...d, listens: countById.get(d.id) ?? 0 }))
      .sort((a, b) => direction * (a.listens - b.listens) || (a.id < b.id ? -1 : 1))
    const winnersByBucket = new Map<string, Array<{ soundId: string; listens: number }>>()
    for (const row of ranked) {
      const bucket = opts.dimension === 'type' ? row.contentType : (row.genre ?? 'Unspecified')
      const list = winnersByBucket.get(bucket) ?? []
      if (list.length < limitPerBucket) list.push({ soundId: row.id, listens: row.listens })
      winnersByBucket.set(bucket, list)
    }
    const entries = await toEntries(prisma, [...winnersByBucket.values()].flat(), sort)
    const entryById = new Map(entries.map((e) => [e.soundId, e]))
    return [...winnersByBucket.entries()]
      .map(([bucket, winners]) => ({
        bucket,
        entries: winners.flatMap((w) => entryById.get(w.soundId) ?? []),
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
