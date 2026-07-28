// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { NewsFeedResponseSchema, openApiResponse } from '@tahti/shared'

const NEWS_FEED_LIMIT = 10

/** Homepage news feed — published posts only, most recent first. */
const newsPublicRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/news',
    {
      schema: {
        tags: ['channel'],
        description: 'Public homepage news feed — published posts, most recent first',
        response: openApiResponse(NewsFeedResponseSchema, 'NewsFeed'),
      },
    },
    async (_request, reply) => {
      const posts = await fastify.prisma.newsPost.findMany({
        where: { publishedAt: { not: null } },
        orderBy: { publishedAt: 'desc' },
        take: NEWS_FEED_LIMIT,
        select: { id: true, headline: true, summary: true, authorName: true, publishedAt: true },
      })

      return reply.send(
        posts.map((p) => ({
          id: p.id,
          headline: p.headline,
          summary: p.summary,
          authorName: p.authorName,
          publishedAt: p.publishedAt!.toISOString(),
        })),
      )
    },
  )
}

export default newsPublicRoute
