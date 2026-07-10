// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ArtistEmbedListSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'

// GET /api/channels/:slug/embeds — public, most recent first
const channelEmbedsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/channels/:slug/embeds',
    {
      schema: {
        tags: ['channel'],
        description: 'Public embedded tracks (SoundCloud, etc.) for a channel',
        response: openApiResponse(ArtistEmbedListSchema, 'ArtistEmbedList'),
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

      const embeds = await fastify.prisma.artistEmbed.findMany({
        where: { userId: channel.userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })

      return reply.send(
        embeds.map((e) => ({
          ...e,
          provider: 'soundcloud' as const,
          createdAt: e.createdAt.toISOString(),
        })),
      )
    },
  )
}

export default channelEmbedsRoute
