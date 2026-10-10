// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ChatFanTokenResponseSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { signCentrifugoToken } from '../../lib/centrifugo-jwt.js'
import { canUseFanChat } from '../../lib/fan-perks.js'
import { userName } from '../../lib/safe-names.js'
import { isAccountChatBanned } from '../../lib/chat-ban.js'

const chatFanTokenRoute: FastifyPluginAsync = async (fastify) => {
  // POST /api/chat/:slug/fan-token — fan-only chat (logged-in active subscribers)
  fastify.post(
    '/api/chat/:slug/fan-token',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(ChatFanTokenResponseSchema, 'ChatFanTokenResponse') },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams
      const user = request.sessionUser!

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: { id: true, userId: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const allowed = await canUseFanChat(fastify.prisma, channel.userId, user.id)
      if (!allowed) {
        return reply.status(403).send({
          error: 'Active fan subscription with FAN_CHAT perk required',
        })
      }

      if (await isAccountChatBanned(fastify.prisma, channel.id, user.id)) {
        return reply.status(403).send({ error: 'banned' })
      }

      const handle = userName(user).slice(0, 32)
      const sub = `${handle}#fan-${user.id.slice(0, 8)}`
      // Connection JWTs can't carry a `channel` claim in Centrifugo v5 (only
      // subscription JWTs can) — the client subscribes explicitly after connect.
      const token = signCentrifugoToken(
        { sub, meta: { userId: user.id, channelId: channel.id, supporter: true } },
        3600,
      )

      return reply.send({
        token,
        handle,
        channel: `channel:${slug}:fans`,
        supporter: true as const,
      })
    },
  )
}

export default chatFanTokenRoute
