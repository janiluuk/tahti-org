// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  COMMUNITY_STORY_EXCERPT_MAX,
  CommunityStoryDetailSchema,
  IdParamSchema,
  openApiResponse,
  parseRouteParams,
  safeDisplayName,
} from '@tahti/shared'
import { availableUserWhere } from '../../lib/listed-artist.js'
import { postExcerpt } from '../../lib/post-excerpt.js'

const communityStoryDetailRoute: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/community/stories/:id — one published story in full, the
  // same posts the list shows (scheduled ones and unavailable artists 404).
  fastify.get(
    '/api/v1/community/stories/:id',
    {
      schema: {
        tags: ['community'],
        response: openApiResponse(CommunityStoryDetailSchema, 'CommunityStoryDetail'),
      },
    },
    async (request, reply) => {
      const params = parseRouteParams(IdParamSchema, request.params)
      if (!params) return reply.status(400).send({ error: 'Invalid path parameters' })

      const post = await fastify.prisma.artistPost.findFirst({
        where: { id: params.id, publishAt: { lte: new Date() }, user: availableUserWhere },
        select: {
          id: true,
          category: true,
          title: true,
          body: true,
          images: true,
          linkUrl: true,
          linkLabel: true,
          publishAt: true,
          user: {
            select: {
              username: true,
              displayName: true,
              avatarUrl: true,
              channel: {
                select: {
                  sounds: {
                    where: { isPublic: true, status: 'READY', bannerUrl: { not: null } },
                    orderBy: [{ releasedAt: 'desc' }, { createdAt: 'desc' }],
                    take: 1,
                    select: { bannerUrl: true },
                  },
                },
              },
            },
          },
        },
      })
      if (!post) return reply.status(404).send({ error: 'Story not found' })

      return reply.header('Cache-Control', 'public, max-age=30').send({
        id: post.id,
        category: post.category,
        title: post.title,
        excerpt: postExcerpt(post.body, COMMUNITY_STORY_EXCERPT_MAX),
        imageUrl: post.images[0] ?? post.user.channel?.sounds[0]?.bannerUrl ?? null,
        publishAt: post.publishAt.toISOString(),
        url: `/u/${post.user.username}`,
        author: {
          username: post.user.username,
          displayName: safeDisplayName(post.user.displayName, post.user.username),
          avatarUrl: post.user.avatarUrl,
        },
        body: post.body,
        images: post.images,
        linkUrl: post.linkUrl,
        linkLabel: post.linkLabel,
      })
    },
  )
}

export default communityStoryDetailRoute
