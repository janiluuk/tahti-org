// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Prisma, type PrismaClient } from '@tahti/db'
import type { LovedListEntry } from '@tahti/shared'
import { getCachedJson } from './json-cache.js'
import { trackArtistName } from './safe-names.js'

const CACHE_TTL_SEC = 600

/** Public tracks ranked by how many people loved them: a like or a LOVE
 * reaction, counted once per listener however many times or ways they did it. */
export async function buildLovedList(
  prisma: PrismaClient,
  opts: { contentTypes?: string[]; genre?: string; limit: number },
): Promise<LovedListEntry[]> {
  const key = `loved-list:${(opts.contentTypes ?? []).slice().sort().join(',')}:${opts.genre ?? ''}:${opts.limit}`
  return getCachedJson(key, CACHE_TTL_SEC, async () => {
    const contentTypeFilter =
      opts.contentTypes && opts.contentTypes.length > 0
        ? Prisma.sql`AND s."contentType"::text IN (${Prisma.join(opts.contentTypes)})`
        : Prisma.empty
    const genreFilter = opts.genre ? Prisma.sql`AND s."genre" = ${opts.genre}` : Prisma.empty
    const top = await prisma.$queryRaw<Array<{ soundId: string; loves: number }>>`
      SELECT l."soundId", COUNT(DISTINCT l."userId")::int AS loves
      FROM (
        SELECT "soundId", "userId" FROM "engagement"."SoundLike"
        UNION ALL
        SELECT "soundId", "userId" FROM "engagement"."TrackReaction" WHERE "type" = 'LOVE'
      ) l
      JOIN "channel"."Sound" s ON s."id" = l."soundId"
      JOIN "channel"."Channel" c ON c."id" = s."channelId"
      JOIN "core"."User" u ON u."id" = c."userId"
      WHERE s."isPublic" AND s."status" = 'READY' AND s."topListsEligible"
        AND u."deletedAt" IS NULL AND u."suspendedAt" IS NULL
        ${contentTypeFilter}
        ${genreFilter}
      GROUP BY l."soundId"
      ORDER BY loves DESC, l."soundId" ASC
      LIMIT ${opts.limit}
    `
    if (top.length === 0) return []

    const items = await prisma.sound.findMany({
      where: { id: { in: top.map((row) => row.soundId) } },
      select: {
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
      },
    })
    const byId = new Map(items.map((item) => [item.id, item]))
    return top.flatMap(({ soundId, loves: count }) => {
      const item = byId.get(soundId)
      if (!item) return []
      return [
        {
          soundId: item.id,
          loves: count,
          title: item.title,
          artistName: trackArtistName(item),
          artistAvatarUrl: item.artistName ? null : item.channel.user.avatarUrl,
          channelSlug: item.channel.slug,
          bannerUrl: item.bannerUrl,
          genre: item.genre,
          contentType: item.contentType,
        },
      ]
    })
  })
}
