// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  BroadcastPreflightViewSchema,
  PatchBroadcastPreflightSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const meBroadcastPreflightRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/channel/preflight — show name / visibility / auto-archive for the
  // active (PREVIEW or LIVE) broadcast session. Broadcasting Setup step 3.
  fastify.get(
    '/api/me/channel/preflight',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(BroadcastPreflightViewSchema, 'BroadcastPreflightView'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const broadcast = await fastify.prisma.broadcast.findFirst({
        where: { channelId: channel.id, endedAt: null },
        orderBy: { startedAt: 'desc' },
        select: { title: true, visibility: true, autoArchive: true },
      })

      return reply.send(
        broadcast ?? { title: null, visibility: 'PUBLIC' as const, autoArchive: true },
      )
    },
  )

  // PATCH /api/me/channel/preflight — set show name / visibility / auto-archive
  // on the active broadcast session before going live.
  fastify.patch(
    '/api/me/channel/preflight',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(BroadcastPreflightViewSchema, 'BroadcastPreflightView'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = PatchBroadcastPreflightSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const body = parsed.data
      if (Object.keys(body).length === 0) {
        return reply.status(400).send({ error: 'Nothing to update' })
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const broadcast = await fastify.prisma.broadcast.findFirst({
        where: { channelId: channel.id, endedAt: null },
        orderBy: { startedAt: 'desc' },
      })
      if (!broadcast) return reply.status(409).send({ error: 'No active broadcast session' })

      const updated = await fastify.prisma.broadcast.update({
        where: { id: broadcast.id },
        data: body,
        select: { title: true, visibility: true, autoArchive: true },
      })

      return reply.send(updated)
    },
  )
}

export default meBroadcastPreflightRoutes
