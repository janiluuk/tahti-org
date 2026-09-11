// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { patchChannelTextLayer } from './sound-helpers.js'

const meChannelTextLayerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/me/channel/text-layer', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { textLayerMode: true, textLayerText: true, textLayerAlign: true },
    })
    if (!channel) return reply.status(404).send({ error: 'Channel not found' })
    return reply.send(channel)
  })

  fastify.patch(
    '/api/me/channel/text-layer',
    { preHandler: requireAuth },
    async (request, reply) => {
      const result = await patchChannelTextLayer(fastify, request.sessionUser!.id, request.body)
      if (!result.ok) return reply.status(result.status).send({ error: result.error })
      return reply.send({
        textLayerMode: result.textLayerMode,
        textLayerText: result.textLayerText,
        textLayerAlign: result.textLayerAlign,
      })
    },
  )
}

export default meChannelTextLayerRoutes
