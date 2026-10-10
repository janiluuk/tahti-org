// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { ChannelAutoplaySchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

// PLAT-086: per-channel switch for the channel page starting playback on
// its own when a listener opens it. Default on.
const meAutoplaySettings: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/channel/autoplay',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(ChannelAutoplaySchema, 'ChannelAutoplay') },
    },
    async (request, reply) => {
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: request.sessionUser!.id },
        select: { autoplayEnabled: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      return reply.send(channel)
    },
  )

  fastify.patch(
    '/api/me/channel/autoplay',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(ChannelAutoplaySchema, 'ChannelAutoplay') },
    },
    async (request, reply) => {
      const parsed = ChannelAutoplaySchema.safeParse(request.body)
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
        data: { autoplayEnabled: parsed.data.autoplayEnabled },
        select: { autoplayEnabled: true },
      })
      return reply.send(updated)
    },
  )
}

export default meAutoplaySettings
