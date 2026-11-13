// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ArtistEventListSchema,
  ChannelEventsQuerySchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import {
  eventVisibilityWhere,
  participantInclude,
  PUBLIC_EVENT_STATUSES,
  serializeArtistEvent,
} from '../../lib/artist-event.js'
import { availableUserWhere } from '../../lib/listed-artist.js'

// GET /api/channels/:slug/events?scope=upcoming|past — owner or accepted participant
const channelEventsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/channels/:slug/events',
    {
      schema: {
        tags: ['channel'],
        description:
          'Public events for an artist channel (owner or accepted lineup). Upcoming soonest first; past newest first.',
        response: openApiResponse(ArtistEventListSchema, 'ArtistEventList'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const query = ChannelEventsQuerySchema.safeParse(request.query)
      if (!query.success) {
        return reply.status(400).send({ error: query.error.issues[0]?.message ?? 'Invalid query' })
      }
      const { scope, limit } = query.data

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug: routeParams.slug },
        select: { userId: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const now = new Date()
      const events = await fastify.prisma.artistEvent.findMany({
        where: {
          AND: [
            {
              OR: [
                { userId: channel.userId },
                { participants: { some: { userId: channel.userId, status: 'ACCEPTED' } } },
              ],
            },
            eventVisibilityWhere(request.sessionUser?.id),
          ],
          startAt: scope === 'upcoming' ? { gte: now } : { lt: now },
          status: { in: [...PUBLIC_EVENT_STATUSES] },
          user: availableUserWhere,
        },
        orderBy: { startAt: scope === 'upcoming' ? 'asc' : 'desc' },
        take: limit,
        include: participantInclude,
      })

      return reply.send(events.map((event) => serializeArtistEvent(event)))
    },
  )
}

export default channelEventsRoute
