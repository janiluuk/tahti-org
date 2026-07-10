// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ArtistEventListSchema,
  ArtistEventSchema,
  CreateArtistEventSchema,
  IdParamSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

function serialize(event: {
  id: string
  title: string
  place: string
  location: string
  eventUrl: string | null
  startAt: Date
}) {
  return { ...event, startAt: event.startAt.toISOString() }
}

const meEventRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/events — all of the artist's own events, soonest first
  fastify.get(
    '/api/me/events',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ArtistEventListSchema, 'ArtistEventList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const events = await fastify.prisma.artistEvent.findMany({
        where: { userId: user.id },
        orderBy: { startAt: 'asc' },
      })
      return reply.send(events.map(serialize))
    },
  )

  // POST /api/me/events — add an event
  fastify.post(
    '/api/me/events',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponses([
          { status: 201, schema: ArtistEventSchema, name: 'ArtistEvent' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = CreateArtistEventSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' })
      }
      const body = parsed.data

      const event = await fastify.prisma.artistEvent.create({
        data: {
          userId: user.id,
          title: body.title,
          place: body.place,
          location: body.location,
          eventUrl: body.eventUrl || null,
          startAt: new Date(body.startAt),
        },
      })

      return reply.status(201).send(serialize(event))
    },
  )

  // DELETE /api/me/events/:id
  fastify.delete(
    '/api/me/events/:id',
    { preHandler: requireAuth, schema: { tags: ['channel'] } },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const event = await fastify.prisma.artistEvent.findFirst({
        where: { id: routeParams.id, userId: user.id },
      })
      if (!event) return reply.status(404).send({ error: 'Event not found' })

      await fastify.prisma.artistEvent.delete({ where: { id: event.id } })
      return reply.status(204).send()
    },
  )
}

export default meEventRoutes
