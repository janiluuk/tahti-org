// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient, Prisma } from '@tahti/db'
import type { LovedListEntry } from '@tahti/shared'
import { getCachedJson } from './json-cache.js'
import { trackArtistName } from './safe-names.js'

const CACHE_TTL_SEC = 30

/** Public tracks ranked by how many people loved them: a like or a LOVE
 * reaction, counted once per listener however many times or ways they did it. */
export async function buildLovedList(
  prisma: PrismaClient,
  opts: { contentTypes?: string[]; genre?: string; limit: number },
): Promise<LovedListEntry[]> {
  const key = `loved-list:${(opts.contentTypes ?? []).slice().sort().join(',')}:${opts.genre ?? ''}:${opts.limit}`
  return getCachedJson(key, CACHE_TTL_SEC, async () => {
    const soundWhere: Prisma.SoundWhereInput = {
      isPublic: true,
      status: 'READY',
      topListsEligible: true,
      channel: { user: { deletedAt: null, suspendedAt: null } },
    }
    if (opts.contentTypes && opts.contentTypes.length > 0) {
      soundWhere.contentType = {
        in: opts.contentTypes as Prisma.EnumSoundContentTypeFilter['in'],
      }
    }
    if (opts.genre) soundWhere.genre = opts.genre

    const [reactions, likes] = await Promise.all([
      prisma.trackReaction.groupBy({
        by: ['soundId', 'userId'],
        where: { type: 'LOVE', sound: soundWhere },
      }),
      prisma.soundLike.findMany({
        where: { sound: soundWhere },
        select: { soundId: true, userId: true },
      }),
    ])
    const lovers = new Map<string, Set<string>>()
    for (const row of [...reactions, ...likes]) {
      const users = lovers.get(row.soundId) ?? new Set<string>()
      users.add(row.userId)
      lovers.set(row.soundId, users)
    }
    const top = [...lovers.entries()]
      .map(([id, users]): [string, number] => [id, users.size])
      .sort((a, b) => b[1] - a[1])
      .slice(0, opts.limit)
    if (top.length === 0) return []

    const items = await prisma.sound.findMany({
      where: { id: { in: top.map(([id]) => id) } },
      select: {
        id: true,
        title: true,
        artistName: true,
        bannerUrl: true,
        genre: true,
        contentType: true,
        channel: {
          select: { slug: true, user: { select: { username: true, displayName: true } } },
        },
      },
    })
    const byId = new Map(items.map((item) => [item.id, item]))
    return top.flatMap(([id, count]) => {
      const item = byId.get(id)
      if (!item) return []
      return [
        {
          soundId: item.id,
          loves: count,
          title: item.title,
          artistName: trackArtistName(item),
          channelSlug: item.channel.slug,
          bannerUrl: item.bannerUrl,
          genre: item.genre,
          contentType: item.contentType,
        },
      ]
    })
  })
}
