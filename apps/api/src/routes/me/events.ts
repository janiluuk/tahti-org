// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { notifyFollowersOfNewEvent } from '@tahti/db'
import {
  ArtistEventListSchema,
  ArtistEventSchema,
  CreateArtistEventSchema,
  IdParamSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
  safeDisplayName,
  UpdateArtistEventSchema,
} from '@tahti/shared'
import {
  notifyTaggedParticipants,
  participantInclude,
  serializeArtistEvent,
} from '../../lib/artist-event.js'
import { requireAuth } from '../../plugins/auth.js'

async function notifyNewEvent(
  fastify: Parameters<FastifyPluginAsync>[0],
  user: { id: string; username: string; displayName: string | null },
  event: { id: string; title: string; startAt: Date; place: string; location: string },
) {
  await notifyFollowersOfNewEvent(
    fastify.prisma,
    {
      id: user.id,
      username: user.username,
      displayName: safeDisplayName(user.displayName, user.username),
    },
    event,
  ).catch((err: unknown) => fastify.log.warn({ err }, 'new-event notification failed'))
}

const serialize = (event: Parameters<typeof serializeArtistEvent>[0]) =>
  serializeArtistEvent(event, { acceptedOnly: false })

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
        include: participantInclude,
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

      const published = body.status === 'PUBLISHED'
      const event = await fastify.prisma.artistEvent.create({
        data: {
          userId: user.id,
          title: body.title,
          description: body.description,
          place: body.place,
          location: body.location,
          eventUrl: body.eventUrl || null,
          ticketUrl: body.ticketUrl || null,
          imageUrl: body.imageUrl || null,
          startAt: new Date(body.startAt),
          endAt: body.endAt ? new Date(body.endAt) : null,
          status: body.status,
          publishedAt: published ? new Date() : null,
        },
        include: participantInclude,
      })

      if (published) await notifyNewEvent(fastify, user, event)

      return reply.status(201).send(serialize(event))
    },
  )

  // PATCH /api/me/events/:id — edits don't notify followers again; only new events do
  fastify.patch(
    '/api/me/events/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ArtistEventSchema, 'ArtistEvent'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const parsed = UpdateArtistEventSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' })
      }
      const body = parsed.data

      const event = await fastify.prisma.artistEvent.findFirst({
        where: { id: routeParams.id, userId: user.id },
        select: { id: true, startAt: true, endAt: true },
      })
      if (!event) return reply.status(404).send({ error: 'Event not found' })
      const nextStart = body.startAt ? new Date(body.startAt) : event.startAt
      const nextEnd =
        body.endAt === undefined ? event.endAt : body.endAt ? new Date(body.endAt) : null
      if (nextEnd && nextEnd <= nextStart) {
        return reply.status(400).send({ error: 'endAt must be after startAt' })
      }

      const updated = await fastify.prisma.artistEvent.update({
        where: { id: event.id },
        data: {
          title: body.title,
          description: body.description,
          place: body.place,
          location: body.location,
          eventUrl: body.eventUrl === undefined ? undefined : body.eventUrl || null,
          ticketUrl: body.ticketUrl === undefined ? undefined : body.ticketUrl || null,
          imageUrl: body.imageUrl === undefined ? undefined : body.imageUrl || null,
          startAt: body.startAt === undefined ? undefined : new Date(body.startAt),
          endAt: body.endAt === undefined ? undefined : body.endAt ? new Date(body.endAt) : null,
        },
        include: participantInclude,
      })
      return reply.send(serialize(updated))
    },
  )

  // POST /api/me/events/:id/publish — a draft goes public; followers hear about it once
  fastify.post(
    '/api/me/events/:id/publish',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ArtistEventSchema, 'ArtistEvent'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const event = await fastify.prisma.artistEvent.findFirst({
        where: { id: routeParams.id, userId: user.id },
        include: participantInclude,
      })
      if (!event) return reply.status(404).send({ error: 'Event not found' })
      if (event.status === 'PUBLISHED') return reply.send(serialize(event))

      const updated = await fastify.prisma.artistEvent.update({
        where: { id: event.id },
        data: { status: 'PUBLISHED', publishedAt: event.publishedAt ?? new Date() },
        include: participantInclude,
      })
      if (!event.publishedAt) {
        await notifyNewEvent(fastify, user, updated)
        await notifyTaggedParticipants(fastify.prisma, user, updated).catch((err: unknown) =>
          fastify.log.warn({ err }, 'event tag notification failed'),
        )
      }
      return reply.send(serialize(updated))
    },
  )

  // POST /api/me/events/:id/cancel — stays listed with a Cancelled badge
  fastify.post(
    '/api/me/events/:id/cancel',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ArtistEventSchema, 'ArtistEvent'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const event = await fastify.prisma.artistEvent.findFirst({
        where: { id: routeParams.id, userId: user.id },
      })
      if (!event) return reply.status(404).send({ error: 'Event not found' })

      const updated = await fastify.prisma.artistEvent.update({
        where: { id: event.id },
        data: { status: 'CANCELLED' },
        include: participantInclude,
      })
      return reply.send(serialize(updated))
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
