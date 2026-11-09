// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ArtistEventInviteListSchema,
  ArtistEventSchema,
  IdParamSchema,
  openApiResponse,
  parseRouteParams,
  safeDisplayName,
  SetArtistEventParticipantsSchema,
} from '@tahti/shared'
import {
  notifyTaggedParticipants,
  participantInclude,
  serializeArtistEvent,
} from '../../lib/artist-event.js'
import { availableUserWhere } from '../../lib/listed-artist.js'
import { requireAuth } from '../../plugins/auth.js'

const eventParticipantRoutes: FastifyPluginAsync = async (fastify) => {
  // PUT /api/me/events/:id/participants — the full tag list; kept people
  // keep their answer, new people start PENDING and hear about it once the
  // event is published.
  fastify.put(
    '/api/me/events/:id/participants',
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
      const parsed = SetArtistEventParticipantsSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' })
      }

      const event = await fastify.prisma.artistEvent.findFirst({
        where: { id: routeParams.id, userId: user.id },
        include: { participants: { select: { userId: true } } },
      })
      if (!event) return reply.status(404).send({ error: 'Event not found' })

      const wanted = new Map(
        parsed.data.participants.map((p) => [p.username.replace(/^@/, '').toLowerCase(), p.role]),
      )
      const users = await fastify.prisma.user.findMany({
        where: {
          username: { in: [...wanted.keys()], mode: 'insensitive' },
          id: { not: user.id },
          ...availableUserWhere,
        },
        select: { id: true, username: true },
      })
      if (users.length !== wanted.size - (wanted.has(user.username.toLowerCase()) ? 1 : 0)) {
        const found = new Set(users.map((u) => u.username.toLowerCase()))
        const missing = [...wanted.keys()].filter(
          (name) => !found.has(name) && name !== user.username.toLowerCase(),
        )
        if (missing.length > 0) {
          return reply.status(400).send({ error: `Unknown account: @${missing[0]}` })
        }
      }

      const existing = new Set(event.participants.map((p) => p.userId))
      const keep = new Set(users.map((u) => u.id))
      const added = users.filter((u) => !existing.has(u.id)).map((u) => u.id)

      await fastify.prisma.$transaction([
        fastify.prisma.artistEventParticipant.deleteMany({
          where: { eventId: event.id, userId: { notIn: [...keep] } },
        }),
        ...users.map((u) =>
          fastify.prisma.artistEventParticipant.upsert({
            where: { eventId_userId: { eventId: event.id, userId: u.id } },
            create: {
              eventId: event.id,
              userId: u.id,
              role: wanted.get(u.username.toLowerCase()) ?? 'PERFORMER',
            },
            update: { role: wanted.get(u.username.toLowerCase()) ?? 'PERFORMER' },
          }),
        ),
      ])

      if (event.status === 'PUBLISHED' && added.length > 0) {
        await notifyTaggedParticipants(fastify.prisma, user, event, added).catch((err: unknown) =>
          fastify.log.warn({ err }, 'event tag notification failed'),
        )
      }

      const updated = await fastify.prisma.artistEvent.findUniqueOrThrow({
        where: { id: event.id },
        include: participantInclude,
      })
      return reply.send(serializeArtistEvent(updated, { acceptedOnly: false }))
    },
  )

  // GET /api/me/event-invites — events other artists tagged me on
  fastify.get(
    '/api/me/event-invites',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ArtistEventInviteListSchema, 'ArtistEventInviteList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const rows = await fastify.prisma.artistEventParticipant.findMany({
        where: {
          userId: user.id,
          event: { status: { in: ['PUBLISHED', 'CANCELLED'] }, startAt: { gte: new Date() } },
        },
        orderBy: { event: { startAt: 'asc' } },
        include: {
          event: {
            include: {
              ...participantInclude,
              user: {
                select: { username: true, displayName: true, channel: { select: { slug: true } } },
              },
            },
          },
        },
      })
      return reply.send(
        rows.map((row) => ({
          event: serializeArtistEvent(row.event),
          host: {
            username: row.event.user.username,
            displayName: safeDisplayName(row.event.user.displayName, row.event.user.username),
            channelSlug: row.event.user.channel?.slug ?? null,
          },
          role: row.role,
          status: row.status,
        })),
      )
    },
  )

  for (const [action, status] of [
    ['accept', 'ACCEPTED'],
    ['decline', 'DECLINED'],
  ] as const) {
    // POST /api/me/event-invites/:id/{accept,decline} — :id is the event id
    fastify.post(
      `/api/me/event-invites/:id/${action}`,
      { preHandler: requireAuth, schema: { tags: ['channel'] } },
      async (request, reply) => {
        const user = request.sessionUser!
        const routeParams = parseRouteParams(IdParamSchema, request.params)
        if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
        const result = await fastify.prisma.artistEventParticipant.updateMany({
          where: { eventId: routeParams.id, userId: user.id },
          data: { status },
        })
        if (result.count === 0) return reply.status(404).send({ error: 'Invite not found' })
        return reply.status(204).send()
      },
    )
  }
}

export default eventParticipantRoutes
