// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Prisma, PrismaClient } from '@tahti/db'
import { safeDisplayName, soundPlaybackKey, type LikedTrack } from '@tahti/shared'
import { resolveGatedPlaybackUrl } from './playback-url.js'
import { resolveChannelUrl } from './channel-url.js'

/** A user's liked tracks, newest first, each with a playback link gated for
 * the viewer (who may be someone other than the liker, or nobody). */
export async function listLikedTracks(
  prisma: PrismaClient,
  opts: {
    likerUserId: string
    viewerUserId: string | null
    soundWhere: Prisma.SoundWhereInput
    limit: number
  },
): Promise<LikedTrack[]> {
  const likes = await prisma.soundLike.findMany({
    where: { userId: opts.likerUserId, sound: opts.soundWhere },
    orderBy: { createdAt: 'desc' },
    take: opts.limit,
    select: {
      createdAt: true,
      sound: {
        select: {
          id: true,
          title: true,
          artistName: true,
          bannerUrl: true,
          mp3Key: true,
          flacKey: true,
          accessMode: true,
          purchaseTierId: true,
          durationSec: true,
          genre: true,
          genreCustom: true,
          peaks: true,
          createdAt: true,
          downloadsEnabled: true,
          _count: { select: { likes: true, listenEvents: true } },
          channel: {
            select: {
              slug: true,
              userId: true,
              user: { select: { username: true, displayName: true } },
            },
          },
        },
      },
    },
  })

  const soundIds = likes.map(({ sound }) => sound.id)
  const downloadCounts = soundIds.length
    ? await prisma.download.groupBy({
        by: ['soundId'],
        where: { soundId: { in: soundIds }, countedAt: { not: null } },
        _count: { _all: true },
      })
    : []
  const downloadsBySoundId = new Map(
    downloadCounts.map((row) => [row.soundId, row._count._all] as const),
  )

  return Promise.all(
    likes.map(async ({ createdAt, sound }) => {
      const { url } = await resolveGatedPlaybackUrl(prisma, {
        playbackKey: soundPlaybackKey(sound),
        artistUserId: sound.channel.userId,
        accessMode: sound.accessMode,
        purchaseTierId: sound.purchaseTierId,
        viewerUserId: opts.viewerUserId,
      })
      const artist = sound.channel.user
      return {
        id: sound.id,
        title: sound.title,
        bannerUrl: sound.bannerUrl,
        audioUrl: url,
        channelSlug: sound.channel.slug,
        artistUsername: artist.username,
        artistDisplayName: sound.artistName || safeDisplayName(artist.displayName, artist.username),
        likedAt: createdAt.toISOString(),
        url: resolveChannelUrl(sound.channel.slug, { hash: `sound-item-${sound.id}` }),
        durationSec: sound.durationSec,
        genre: sound.genreCustom ?? sound.genre,
        peaks: Array.isArray(sound.peaks) ? (sound.peaks as number[]) : null,
        createdAt: sound.createdAt.toISOString(),
        downloadsEnabled: sound.downloadsEnabled,
        likeCount: sound._count.likes,
        playCount: sound._count.listenEvents,
        downloadCount: downloadsBySoundId.get(sound.id) ?? 0,
      }
    }),
  )
}
