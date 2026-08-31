// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { FeedItem } from '@tahti/shared'
import { MyFeedResponseSchema, archivePlaybackKey, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { resolveChannelUrl } from '../../lib/channel-url.js'
import { resolveReleaseArtworkUrl } from '../../lib/release-artwork.js'
import { presignedGetUrl } from '../../lib/minio.js'

const FEED_LIMIT = 40

// GET /api/me/feed — recent posts, public tracks, and (for Tahti Radio–opted-in
// artists) published releases from artists the current user follows.
const meFeedRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/feed',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M40: activity feed from followed artists',
        response: openApiResponse(MyFeedResponseSchema, 'MyFeed'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!

      const follows = await fastify.prisma.artistFollow.findMany({
        where: { followerUserId: user.id },
        select: { artistUserId: true },
      })
      const artistIds = follows.map((f) => f.artistUserId)

      if (artistIds.length === 0) {
        return reply.send({ items: [], followingCount: 0 })
      }

      const [posts, tracks, releases] = await Promise.all([
        fastify.prisma.artistPost.findMany({
          where: { userId: { in: artistIds }, publishAt: { lte: new Date() } },
          orderBy: { publishAt: 'desc' },
          take: FEED_LIMIT,
          include: { user: { select: { username: true, displayName: true, avatarUrl: true } } },
        }),
        fastify.prisma.archiveItem.findMany({
          where: { channel: { userId: { in: artistIds } }, isPublic: true, status: 'READY' },
          orderBy: { createdAt: 'desc' },
          take: FEED_LIMIT,
          select: {
            id: true,
            title: true,
            bannerUrl: true,
            mp3Key: true,
            flacKey: true,
            createdAt: true,
            channel: {
              select: {
                slug: true,
                user: { select: { username: true, displayName: true, avatarUrl: true } },
              },
            },
          },
        }),
        // Releases only surface when the artist is opted into Tahti Radio
        // (`metaStreamOptOut = false` — included by default).
        fastify.prisma.release.findMany({
          where: {
            userId: { in: artistIds },
            state: 'PUBLISHED',
            publishedAt: { not: null },
            user: { channel: { metaStreamOptOut: false } },
          },
          orderBy: { publishedAt: 'desc' },
          take: FEED_LIMIT,
          select: {
            id: true,
            title: true,
            type: true,
            artworkUrl: true,
            artworkKey: true,
            publishedAt: true,
            smartLinkSlug: true,
            user: { select: { username: true, displayName: true, avatarUrl: true } },
          },
        }),
      ])

      const trackIds = tracks.map((t) => t.id)
      const myLikes = trackIds.length
        ? await fastify.prisma.archiveItemLike.findMany({
            where: { userId: user.id, archiveItemId: { in: trackIds } },
            select: { archiveItemId: true },
          })
        : []
      const likedIds = new Set(myLikes.map((l) => l.archiveItemId))
      const likeCounts = trackIds.length
        ? await fastify.prisma.archiveItemLike.groupBy({
            by: ['archiveItemId'],
            where: { archiveItemId: { in: trackIds } },
            _count: true,
          })
        : []
      const likeCountById = new Map(likeCounts.map((l) => [l.archiveItemId, l._count]))
      const audioUrlByTrackId = new Map<string, string | null>(
        await Promise.all(
          tracks.map(async (track) => {
            const key = archivePlaybackKey(track)
            return [track.id, key ? await presignedGetUrl(key, 3600) : null] as const
          }),
        ),
      )

      const releaseItems: FeedItem[] = await Promise.all(
        releases.map(async (r): Promise<FeedItem> => ({
          kind: 'release',
          id: r.id,
          date: (r.publishedAt ?? new Date()).toISOString(),
          artist: r.user,
          title: r.title,
          releaseType: r.type,
          artworkUrl: await resolveReleaseArtworkUrl(r),
          url: `/r/${r.smartLinkSlug}`,
        })),
      )

      const items: FeedItem[] = [
        ...posts.map((p): FeedItem => ({
          kind: 'post',
          id: p.id,
          date: p.publishAt.toISOString(),
          artist: p.user,
          title: p.title,
          body: p.body,
          images: p.images,
          url: `/u/${p.user.username}`,
        })),
        ...tracks.map((t): FeedItem => ({
          kind: 'track',
          id: t.id,
          date: t.createdAt.toISOString(),
          artist: t.channel.user,
          title: t.title,
          bannerUrl: t.bannerUrl,
          audioUrl: audioUrlByTrackId.get(t.id) ?? null,
          channelSlug: t.channel.slug,
          liked: likedIds.has(t.id),
          likeCount: likeCountById.get(t.id) ?? 0,
          url: resolveChannelUrl(t.channel.slug, { hash: `archive-item-${t.id}` }),
        })),
        ...releaseItems,
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, FEED_LIMIT)

      return reply.send({ items, followingCount: artistIds.length })
    },
  )
}

export default meFeedRoutes
