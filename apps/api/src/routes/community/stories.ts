// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@tahti/db'
import {
  COMMUNITY_STORIES_DEFAULT_LIMIT,
  COMMUNITY_STORIES_MAX_LIMIT,
  COMMUNITY_STORY_EXCERPT_MAX,
  CommunityStoriesQuerySchema,
  CommunityStoriesResponseSchema,
  openApiResponse,
  safeDisplayName,
  type CommunityStory,
} from '@tahti/shared'
import { availableUserWhere } from '../../lib/listed-artist.js'
import { postExcerpt } from '../../lib/post-excerpt.js'

const communityStoriesRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/community/stories',
    {
      schema: {
        tags: ['discover'],
        description:
          'Published artist posts from all available artists, newest first. Keyset-paginated: pass the previous page’s nextCursor as cursor.',
        querystring: {
          type: 'object',
          properties: {
            cursor: { type: 'string', description: 'Post id from a previous nextCursor' },
            limit: {
              type: 'integer',
              minimum: 1,
              default: COMMUNITY_STORIES_DEFAULT_LIMIT,
              description: `Page size; values above ${COMMUNITY_STORIES_MAX_LIMIT} are clamped`,
            },
          },
        },
        response: openApiResponse(CommunityStoriesResponseSchema, 'CommunityStories'),
      },
    },
    async (request, reply) => {
      const parsed = CommunityStoriesQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid query' })
      }
      const { cursor, limit } = parsed.data

      const where: Prisma.ArtistPostWhereInput = {
        publishAt: { lte: new Date() },
        user: availableUserWhere,
      }
      if (cursor) {
        const anchor = await fastify.prisma.artistPost.findUnique({
          where: { id: cursor },
          select: { id: true, publishAt: true },
        })
        if (!anchor) return reply.status(400).send({ error: 'Invalid cursor' })
        where.OR = [
          { publishAt: { lt: anchor.publishAt } },
          { publishAt: anchor.publishAt, id: { lt: anchor.id } },
        ]
      }

      const posts = await fastify.prisma.artistPost.findMany({
        where,
        orderBy: [{ publishAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        select: {
          id: true,
          category: true,
          title: true,
          body: true,
          images: true,
          publishAt: true,
          user: { select: { username: true, displayName: true, avatarUrl: true } },
        },
      })

      const page = posts.slice(0, limit)
      const items = page.map((p): CommunityStory => ({
        id: p.id,
        category: p.category,
        title: p.title,
        excerpt: postExcerpt(p.body, COMMUNITY_STORY_EXCERPT_MAX),
        imageUrl: p.images[0] ?? null,
        publishAt: p.publishAt.toISOString(),
        url: `/u/${p.user.username}`,
        author: {
          username: p.user.username,
          displayName: safeDisplayName(p.user.displayName, p.user.username),
          avatarUrl: p.user.avatarUrl,
        },
      }))
      const nextCursor = posts.length > limit ? (page[page.length - 1]?.id ?? null) : null

      return reply.header('Cache-Control', 'public, max-age=30').send({ items, nextCursor })
    },
  )
}

export default communityStoriesRoute
