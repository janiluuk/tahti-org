// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { forceChannelOffline } from '../../lib/force-channel-offline.js'

const meEndBroadcastRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/me/channel/end-broadcast',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Artist-initiated end broadcast — stops Liquidsoap and sets channel OFFLINE',
        response: {
          200: {
            type: 'object',
            properties: { ok: { type: 'boolean' } },
          },
          409: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true, slug: true, state: true },
      })

      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      if (channel.state !== 'LIVE') {
        return reply.status(409).send({ error: 'Channel is not live' })
      }

      await forceChannelOffline(fastify.prisma, fastify.log, {
        channelId: channel.id,
        slug: channel.slug,
      })

      return reply.send({ ok: true as const })
    },
  )
}

export default meEndBroadcastRoutes
