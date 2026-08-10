// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ChatHistoryResponseSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { config } from '../../config.js'
import { getCachedJson } from '../../lib/json-cache.js'

const chatHistoryRoute: FastifyPluginAsync = async (fastify) => {
  // GET /api/chat/:slug/history — recent messages from Centrifugo's own history
  // buffer (history_size/history_ttl in infra/centrifugo.json), fetched once on
  // join so a fresh page load or WS reconnect isn't a blank chat. Chat has no
  // database persistence — anything outside this buffer is gone for good.
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
        try {
          const res = await fetch(`${config.centrifugo.apiUrl}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `apikey ${config.centrifugo.apiKey}`,
            },
            body: JSON.stringify({
              method: 'history',
              params: { channel: `channel:${slug}`, limit: 100, reverse: false },
            }),
            signal: AbortSignal.timeout(2000),
          })

          if (!res.ok) return { messages: [] }

          const data = (await res.json()) as {
            result?: { publications?: { data?: Record<string, unknown> }[] }
          }
          const messages = (data.result?.publications ?? [])
            .map((p) => p.data)
            .filter((d): d is Record<string, unknown> => Boolean(d && typeof d.text === 'string'))
          return { messages }
        } catch {
          return { messages: [] }
        }
      })
      return reply.send(result)
    },
  )
}

export default chatHistoryRoute
