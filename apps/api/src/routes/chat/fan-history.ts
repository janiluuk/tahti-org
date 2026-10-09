// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ChatHistoryResponseSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { canUseFanChat } from '../../lib/fan-perks.js'
import { getCachedJson } from '../../lib/json-cache.js'

const HISTORY_LIMIT = 100

const chatFanHistoryRoute: FastifyPluginAsync = async (fastify) => {
  // GET /api/chat/:slug/fan-history — recent fan-room messages for the artist
  // and their fan-chat subscribers (the public history leaves them out).
  fastify.get(
    '/api/chat/:slug/fan-history',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['chat'],
        response: openApiResponse(ChatHistoryResponseSchema, 'ChatHistory'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: { id: true, userId: true, user: { select: { chatEnabled: true } } },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      if (!channel.user.chatEnabled) return reply.send({ messages: [] })

      if (!(await canUseFanChat(fastify.prisma, channel.userId, request.sessionUser!.id))) {
        return reply.status(403).send({ error: 'fan_chat_required' })
      }

      const result = await getCachedJson(`chat-fan-history:${slug}`, 5, async () => {
        const rows = await fastify.prisma.chatMessage.findMany({
          where: { channelId: channel.id, fanOnly: true },
          orderBy: { createdAt: 'desc' },
          take: HISTORY_LIMIT,
          select: {
            handle: true,
            text: true,
            supporter: true,
            channelRole: true,
            countryCode: true,
            createdAt: true,
          },
        })
        const messages = rows.reverse().map((r) => ({
          handle: r.handle,
          text: r.text,
          ts: r.createdAt.getTime(),
          supporter: r.supporter,
          channelRole:
            r.channelRole === 'owner' || r.channelRole === 'moderator' ? r.channelRole : null,
          countryCode: r.countryCode,
        }))
        return { messages }
      })
      return reply.send(result)
    },
  )
}

export default chatFanHistoryRoute
