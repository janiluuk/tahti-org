// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  GreenRoomAccessViewSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { resolveGreenRoomAccess } from '../../lib/green-room.js'

const meGreenRoomAccessRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/green-room/:slug',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(GreenRoomAccessViewSchema, 'GreenRoomAccess'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const access = await resolveGreenRoomAccess(
        fastify.prisma,
        routeParams.slug,
        request.sessionUser!.id,
      )
      if (!access) return reply.status(404).send({ error: 'Channel not found' })

      return reply.send(access)
    },
  )

  fastify.post(
    '/api/me/green-room/:slug/join',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(GreenRoomAccessViewSchema, 'GreenRoomAccess'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug: routeParams.slug },
        select: {
          id: true,
          state: true,
          userId: true,
          user: { select: { username: true, displayName: true } },
        },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      if (channel.userId === user.id) {
        const access = await resolveGreenRoomAccess(fastify.prisma, routeParams.slug, user.id)
        return reply.send(access!)
      }

      const broadcast = await fastify.prisma.broadcast.findFirst({
        where: { channelId: channel.id, endedAt: null },
        orderBy: { startedAt: 'desc' },
        select: { id: true, greenRoomEnabled: true },
      })

      if (!broadcast?.greenRoomEnabled || channel.state !== 'PREVIEW') {
        return reply.status(403).send({ error: 'Green room is not open' })
      }

      const invite = await fastify.prisma.broadcastGreenRoomInvite.findUnique({
        where: { broadcastId_userId: { broadcastId: broadcast.id, userId: user.id } },
      })
      if (!invite)
        return reply.status(403).send({ error: 'You are not invited to this green room' })

      if (!invite.joinedAt) {
        await fastify.prisma.broadcastGreenRoomInvite.update({
          where: { id: invite.id },
          data: { joinedAt: new Date() },
        })
      }

      const access = await resolveGreenRoomAccess(fastify.prisma, routeParams.slug, user.id)
      return reply.send(access!)
    },
  )
}

export default meGreenRoomAccessRoutes
