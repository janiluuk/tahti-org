// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import {
  archivePlaybackKey,
  parseSocialLinksGenres,
  type TahtiSelectsGalleryItem,
} from '@tahti/shared'
import { presignedGetUrl } from './minio.js'

const CANDIDATE_POOL = 200
const DEFAULT_LIMIT = 24
const MAX_HEARD = 5_000
const TOP_PREF_GENRES = 8

function normalizeGenre(g: string): string {
  return g.trim().toLowerCase()
}

function displayGenre(g: string): string {
  const t = g.trim()
  if (!t) return t
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function itemGenres(item: {
  genre: string | null
  genreCustom: string | null
  subGenres: string[]
}): string[] {
  const out: string[] = []
  if (item.genre) out.push(item.genre)
  if (item.genreCustom) out.push(item.genreCustom)
  for (const s of item.subGenres) out.push(s)
  return out
}

/** Collect genre labels the listener has already signaled interest in via
 * listens, likes, and artists they follow — capped and frequency-ranked. */
export async function resolvePreferenceGenres(
  prisma: PrismaClient,
  userId: string,
): Promise<string[]> {
  const counts = new Map<string, { count: number; label: string }>()

  function bump(raw: string) {
    const key = normalizeGenre(raw)
    if (!key) return
    const prev = counts.get(key)
    if (prev) prev.count += 1
    else counts.set(key, { count: 1, label: displayGenre(raw) })
  }

  const [listened, liked, following] = await Promise.all([
    prisma.listenEvent.findMany({
      where: { dedupeKey: `user:${userId}` },
      orderBy: { playedAt: 'desc' },
      take: 200,
      select: {
        archiveItem: {
          select: { genre: true, genreCustom: true, subGenres: true },
        },
      },
    }),
    prisma.archiveItemLike.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        archiveItem: {
          select: { genre: true, genreCustom: true, subGenres: true },
        },
      },
    }),
    prisma.artistFollow.findMany({
      where: { followerUserId: userId },
      take: 100,
      select: { artist: { select: { socialLinks: true } } },
    }),
  ])

  for (const row of listened) {
    for (const g of itemGenres(row.archiveItem)) bump(g)
  }
  for (const row of liked) {
    for (const g of itemGenres(row.archiveItem)) bump(g)
  }
  for (const row of following) {
    for (const g of parseSocialLinksGenres(row.artist.socialLinks)) bump(g)
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_PREF_GENRES)
    .map((g) => g.label)
}

export async function buildNewToYou(
  prisma: PrismaClient,
  userId: string,
  limit = DEFAULT_LIMIT,
): Promise<{ preferenceGenres: string[]; items: TahtiSelectsGalleryItem[] }> {
  const preferenceGenres = await resolvePreferenceGenres(prisma, userId)
  const preferredKeys = new Set(preferenceGenres.map(normalizeGenre))

  const [heardRows, followedRows] = await Promise.all([
    prisma.listenEvent.findMany({
      where: { dedupeKey: `user:${userId}` },
      select: { archiveItemId: true },
      distinct: ['archiveItemId'],
      take: MAX_HEARD,
    }),
    prisma.artistFollow.findMany({
      where: { followerUserId: userId },
      select: { artistUserId: true },
    }),
  ])

  const heardIds = heardRows.map((r) => r.archiveItemId)
  const followedUserIds = new Set(followedRows.map((r) => r.artistUserId))

  const candidates = await prisma.archiveItem.findMany({
    where: {
      isPublic: true,
      status: 'READY',
      ...(heardIds.length > 0 ? { id: { notIn: heardIds } } : {}),
      OR: [{ mp3Key: { not: null } }, { flacKey: { not: null } }],
    },
    orderBy: { releasedAt: 'desc' },
    take: CANDIDATE_POOL,
    select: {
      id: true,
      title: true,
      artistName: true,
      bannerUrl: true,
      durationSec: true,
      mp3Key: true,
      flacKey: true,
      genre: true,
      genreCustom: true,
      subGenres: true,
      releasedAt: true,
      channel: {
        select: {
          slug: true,
          userId: true,
          user: { select: { username: true, displayName: true, socialLinks: true } },
        },
      },
    },
  })

  const scored = candidates.map((item, index) => {
    let score = CANDIDATE_POOL - index // recency within the pool
    if (followedUserIds.has(item.channel.userId)) score += 100

    const trackGenres = itemGenres(item)
    const artistGenres = parseSocialLinksGenres(item.channel.user.socialLinks)
    const all = [...trackGenres, ...artistGenres]
    const genreHit = preferredKeys.size > 0 && all.some((g) => preferredKeys.has(normalizeGenre(g)))
    if (genreHit) score += 50

    return { item, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const picked = scored.slice(0, limit).map((s) => s.item)

  const items = await Promise.all(
    picked.map(async (item) => {
      const playbackKey = archivePlaybackKey(item)
      const audioUrl = playbackKey ? await presignedGetUrl(playbackKey, 3600) : null
      return {
        archiveItemId: item.id,
        title: item.title,
        artistName: item.artistName ?? item.channel.user.displayName,
        artistUsername: item.artistName ? null : item.channel.user.username,
        channelSlug: item.channel.slug,
        bannerUrl: item.bannerUrl,
        durationSec: item.durationSec,
        audioUrl,
      } satisfies TahtiSelectsGalleryItem
    }),
  )

  return { preferenceGenres, items }
}
