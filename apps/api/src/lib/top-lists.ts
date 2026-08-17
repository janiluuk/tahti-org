// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient, Prisma } from '@tahti/db'

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
  archiveItemId: string
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
  extraWhere: Prisma.ArchiveItemWhereInput = {},
): Promise<TopListEntry[]> {
  const grouped = await prisma.listenEvent.groupBy({
    by: ['archiveItemId'],
    where: {
      ...(since ? { playedAt: { gte: since } } : {}),
      archiveItem: { isPublic: true, status: 'READY', topListsEligible: true, ...extraWhere },
    },
    _count: { _all: true },
  })
  if (grouped.length === 0) return []
  const countById = new Map(grouped.map((g) => [g.archiveItemId, g._count._all]))

  const items = await prisma.archiveItem.findMany({
    where: { id: { in: grouped.map((g) => g.archiveItemId) } },
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
      archiveItemId: item.id,
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
  const where: Prisma.ArchiveItemWhereInput = {}
  if (opts.contentTypes && opts.contentTypes.length > 0) {
    where.contentType = { in: opts.contentTypes as Prisma.EnumArchiveContentTypeFilter['in'] }
  }
  if (opts.genre) where.genre = opts.genre
  const ranked = await rankedEntriesSince(prisma, opts.since, where)
  if (opts.sort === 'asc') ranked.reverse()
  return ranked.slice(0, opts.limit ?? 20)
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
    .map(([bucket, entries]) => ({ bucket, entries: entries.slice(0, opts.limitPerBucket ?? 10) }))
    .sort((a, b) => (b.entries[0]?.listens ?? 0) - (a.entries[0]?.listens ?? 0))
}

/** Best (lowest) 1-based rank for each requested track across the two lists
 * the public rank badge cares about — this month's top 50, and all-time's
 * top 50 — or undefined if it doesn't place in either. */
export async function rankLookup(
  prisma: PrismaClient,
  archiveItemIds: string[],
): Promise<Map<string, number>> {
  if (archiveItemIds.length === 0) return new Map()

  const [monthList, allTimeList] = await Promise.all([
    buildTopList(prisma, { since: periodSince('month'), limit: 50 }),
    buildTopList(prisma, { limit: 50 }),
  ])

  const best = new Map<string, number>()
  for (const list of [monthList, allTimeList]) {
    list.forEach((entry, i) => {
      if (!archiveItemIds.includes(entry.archiveItemId)) return
      const rank = i + 1
      const existing = best.get(entry.archiveItemId)
      if (existing === undefined || rank < existing) best.set(entry.archiveItemId, rank)
    })
  }
  return best
}
