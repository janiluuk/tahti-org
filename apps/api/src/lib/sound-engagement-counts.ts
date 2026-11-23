// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'

export interface SoundEngagementCounts {
  likeCount: number
  commentCount: number
  playCount: number
  downloadCount: number
}

const ZERO_COUNTS: SoundEngagementCounts = Object.freeze({
  likeCount: 0,
  commentCount: 0,
  playCount: 0,
  downloadCount: 0,
})

type CountRow = { soundId: string | null; _count: { _all: number } }

function bySoundId(rows: CountRow[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) if (row.soundId) map.set(row.soundId, row._count._all)
  return map
}

/** Like, comment, play and counted-download totals for a list of sounds, as
 * one `groupBy` per relation scoped to `soundIds`. Use this instead of
 * Prisma's `_count` on `findMany` lists: without `relationJoins`, `_count`
 * aggregates the whole child table and filters afterwards, so every list
 * view would scan all of `ListenEvent`, `SoundLike` and `Comment`. */
export async function loadSoundEngagementCounts(
  prisma: PrismaClient,
  soundIds: readonly string[],
): Promise<(soundId: string) => SoundEngagementCounts> {
  const ids = [...new Set(soundIds)]
  if (ids.length === 0) return () => ZERO_COUNTS

  const where = { soundId: { in: ids } }
  const [likes, comments, plays, downloads] = await Promise.all([
    prisma.soundLike.groupBy({ by: ['soundId'], where, _count: { _all: true } }),
    prisma.comment.groupBy({ by: ['soundId'], where, _count: { _all: true } }),
    prisma.listenEvent.groupBy({ by: ['soundId'], where, _count: { _all: true } }),
    prisma.download.groupBy({
      by: ['soundId'],
      where: { ...where, countedAt: { not: null } },
      _count: { _all: true },
    }),
  ])
  const likeMap = bySoundId(likes)
  const commentMap = bySoundId(comments)
  const playMap = bySoundId(plays)
  const downloadMap = bySoundId(downloads)

  return (soundId) => ({
    likeCount: likeMap.get(soundId) ?? 0,
    commentCount: commentMap.get(soundId) ?? 0,
    playCount: playMap.get(soundId) ?? 0,
    downloadCount: downloadMap.get(soundId) ?? 0,
  })
}
