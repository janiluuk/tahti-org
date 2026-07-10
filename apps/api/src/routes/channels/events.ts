// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ArtistEventListSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'

// GET /api/channels/:slug/events — public, upcoming events only
const channelEventsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/channels/:slug/events',
    {
      schema: {
        tags: ['channel'],
        description: 'Public upcoming events for an artist channel',
        response: openApiResponse(ArtistEventListSchema, 'ArtistEventList'),
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

      const events = await fastify.prisma.artistEvent.findMany({
        where: { userId: channel.userId, startAt: { gte: new Date() } },
        orderBy: { startAt: 'asc' },
        take: 20,
      })

      return reply.send(events.map((e) => ({ ...e, startAt: e.startAt.toISOString() })))
    },
  )
}

export default channelEventsRoute
