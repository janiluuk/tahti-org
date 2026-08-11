// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ChatHistoryResponseSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { getCachedJson } from '../../lib/json-cache.js'

const HISTORY_LIMIT = 100

const chatHistoryRoute: FastifyPluginAsync = async (fastify) => {
  // GET /api/chat/:slug/history — recent messages, fetched once on join so a
  // fresh page load or WS reconnect isn't a blank chat. Backed by the
  // permanent ChatMessage table (see routes/chat/message.ts), not
  // Centrifugo's own history buffer, which is a 1h rolling in-memory window
  // with nothing surviving a restart.
  fastify.get(
    '/api/chat/:slug/history',
    {
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
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const result = await getCachedJson(`chat-history:${slug}`, 5, async () => {
        const rows = await fastify.prisma.chatMessage.findMany({
          where: { channelId: channel.id, fanOnly: false },
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

export default chatHistoryRoute
