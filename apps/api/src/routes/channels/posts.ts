// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ArtistPostListSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'

// GET /api/channels/:slug/posts — public, most recent first
const channelPostsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/channels/:slug/posts',
    {
      schema: {
        tags: ['channel'],
        description: 'Public artist updates/news posts for a channel',
        response: openApiResponse(ArtistPostListSchema, 'ArtistPostList'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug: routeParams.slug },
        select: { userId: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const posts = await fastify.prisma.artistPost.findMany({
        where: { userId: channel.userId, publishAt: { lte: new Date() } },
        orderBy: { publishAt: 'desc' },
        take: 20,
      })

      return reply.send(
        posts.map((p) => ({
          ...p,
          publishAt: p.publishAt.toISOString(),
          createdAt: p.createdAt.toISOString(),
        })),
      )
    },
  )
}

export default channelPostsRoute
