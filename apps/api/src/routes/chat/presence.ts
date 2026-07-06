// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ChatPresenceResponseSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { config } from '../../config.js'
import { getCachedJson } from '../../lib/json-cache.js'

const chatPresenceRoute: FastifyPluginAsync = async (fastify) => {
  // GET /api/channels/:slug/presence — listener count from Centrifugo
  fastify.get(
    '/api/channels/:slug/presence',
    {
      schema: {
        tags: ['chat'],
        response: openApiResponse(ChatPresenceResponseSchema, 'ChatPresence'),
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

      // Every listener's browser tab polls this every 30s (sticky-live-bar.tsx) — a
      // short cache collapses concurrent pollers on a popular channel into one
      // upstream Centrifugo call instead of one per client.
      const result = await getCachedJson(`presence:${slug}`, 5, async () => {
        try {
          const res = await fetch(`${config.centrifugo.apiUrl}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `apikey ${config.centrifugo.apiKey}`,
            },
            body: JSON.stringify({
              method: 'presence_stats',
              params: { channel: `channel:${slug}` },
            }),
            signal: AbortSignal.timeout(2000),
          })

          if (!res.ok) return { numClients: 0 }

          const data = (await res.json()) as { result?: { num_clients?: number } }
          return { numClients: data.result?.num_clients ?? 0 }
        } catch {
          return { numClients: 0 }
        }
      })
      return reply.send(result)
    },
  )
}

export default chatPresenceRoute
