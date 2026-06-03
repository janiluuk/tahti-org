// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { SlugParamSchema, parseRouteParams } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { signCentrifugoToken } from '../../lib/centrifugo-jwt.js'
import { subscriberHasFanChat } from '../../lib/fan-perks.js'

const chatFanTokenRoute: FastifyPluginAsync = async (fastify) => {
  // POST /api/chat/:slug/fan-token — fan-only chat (logged-in active subscribers)
  fastify.post('/api/chat/:slug/fan-token', { preHandler: requireAuth }, async (request, reply) => {
    const routeParams = parseRouteParams(SlugParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const { slug } = routeParams
    const user = request.sessionUser!

    const channel = await fastify.prisma.channel.findUnique({
      where: { slug },
      select: { id: true, userId: true },
    })
    if (!channel) return reply.status(404).send({ error: 'Channel not found' })

    const allowed = await subscriberHasFanChat(fastify.prisma, channel.userId, user.id)
    if (!allowed) {
      return reply.status(403).send({
        error: 'Active fan subscription with FAN_CHAT perk required',
      })
    }

    const handle = (user.displayName || user.username).slice(0, 32)
    const sub = `${handle}#fan-${user.id.slice(0, 8)}`
    const token = signCentrifugoToken({ sub, channel: `channel:${slug}:fans` }, 3600)

    return reply.send({
      token,
      handle,
      channel: `channel:${slug}:fans`,
      supporter: true,
    })
  })
}

export default chatFanTokenRoute
