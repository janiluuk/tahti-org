// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { FeedItem } from '@tahti/shared'
import { MyFeedResponseSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { resolveChannelUrl } from '../../lib/channel-url.js'

const FEED_LIMIT = 40

// GET /api/me/feed — recent posts + new public tracks from artists the current
// user follows, merged and sorted newest-first.
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

      const [posts, tracks] = await Promise.all([
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
            createdAt: true,
            channel: {
              select: {
                slug: true,
                user: { select: { username: true, displayName: true, avatarUrl: true } },
              },
            },
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

      const items: FeedItem[] = [
        ...posts.map(
          (p): FeedItem => ({
            kind: 'post',
            id: p.id,
            date: p.publishAt.toISOString(),
            artist: p.user,
            title: p.title,
            body: p.body,
            url: `/u/${p.user.username}`,
          }),
        ),
        ...tracks.map(
          (t): FeedItem => ({
            kind: 'track',
            id: t.id,
            date: t.createdAt.toISOString(),
            artist: t.channel.user,
            title: t.title,
            bannerUrl: t.bannerUrl,
            channelSlug: t.channel.slug,
            liked: likedIds.has(t.id),
            likeCount: likeCountById.get(t.id) ?? 0,
            url: resolveChannelUrl(t.channel.slug, { hash: `archive-item-${t.id}` }),
          }),
        ),
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, FEED_LIMIT)

      return reply.send({ items, followingCount: artistIds.length })
    },
  )
}

export default meFeedRoutes
