// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  UpcomingEventListSchema,
  UpcomingEventsQuerySchema,
  openApiResponse,
  safeDisplayName,
} from '@tahti/shared'
import { availableUserWhere } from '../../lib/listed-artist.js'

// GET /api/v1/events/upcoming — public, every artist's next events, soonest first
const upcomingEventsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/events/upcoming',
    {
      schema: {
        tags: ['channel'],
        description:
          'Upcoming public events across all available artists, soonest first (front page "Coming up").',
        response: openApiResponse(UpcomingEventListSchema, 'UpcomingEventList'),
      },
    },
    async (request, reply) => {
      const parsed = UpcomingEventsQuerySchema.safeParse(request.query)
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid query' })

      const events = await fastify.prisma.artistEvent.findMany({
        where: { startAt: { gte: new Date() }, user: availableUserWhere },
        orderBy: { startAt: 'asc' },
        take: parsed.data.limit,
        include: {
          user: {
            select: {
              username: true,
              displayName: true,
              avatarUrl: true,
              channel: { select: { slug: true } },
            },
          },
        },
      })

      return reply.send(
        events.map(({ user, userId: _userId, createdAt: _createdAt, ...event }) => ({
          ...event,
          startAt: event.startAt.toISOString(),
          artistDisplayName: safeDisplayName(user.displayName, user.username),
          artistUsername: user.username,
          channelSlug: user.channel?.slug ?? null,
          avatarUrl: user.avatarUrl ?? null,
        })),
      )
    },
  )
}

export default upcomingEventsRoute
