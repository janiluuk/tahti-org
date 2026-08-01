// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  GreenRoomDefaultsSchema,
  PatchGreenRoomDefaultsSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const meGreenRoomDefaultsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/channel/green-room-defaults',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(GreenRoomDefaultsSchema, 'GreenRoomDefaults'),
      },
    },
    async (request, reply) => {
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: request.sessionUser!.id },
        select: {
          greenRoomDefaultEnabled: true,
          greenRoomDefaultInvitePool: true,
        },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      return reply.send({
        defaultEnabled: channel.greenRoomDefaultEnabled,
        defaultInvitePool: channel.greenRoomDefaultInvitePool,
      })
    },
  )

  fastify.patch(
    '/api/me/channel/green-room-defaults',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(GreenRoomDefaultsSchema, 'GreenRoomDefaults'),
      },
    },
    async (request, reply) => {
      const parsed = PatchGreenRoomDefaultsSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' })
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: request.sessionUser!.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const updated = await fastify.prisma.channel.update({
        where: { id: channel.id },
        data: {
          ...(parsed.data.defaultEnabled !== undefined
            ? { greenRoomDefaultEnabled: parsed.data.defaultEnabled }
            : {}),
          ...(parsed.data.defaultInvitePool !== undefined
            ? { greenRoomDefaultInvitePool: parsed.data.defaultInvitePool }
            : {}),
        },
        select: {
          greenRoomDefaultEnabled: true,
          greenRoomDefaultInvitePool: true,
        },
      })

      return reply.send({
        defaultEnabled: updated.greenRoomDefaultEnabled,
        defaultInvitePool: updated.greenRoomDefaultInvitePool,
      })
    },
  )
}

export default meGreenRoomDefaultsRoutes
