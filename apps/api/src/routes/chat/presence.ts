// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ChatDailyListenersResponseSchema,
  ChatPresenceResponseSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { config } from '../../config.js'
import { getCachedJson } from '../../lib/json-cache.js'
import { fetchMeasuredHlsListenersByDate } from '../../lib/hls-egress-measured.js'

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
        select: { id: true, listenerPeak: true },
      })

      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      // Every listener's browser tab polls this every 30s (sticky-live-bar.tsx) — a
      // short cache collapses concurrent pollers on a popular channel into one
      // upstream Centrifugo call instead of one per client. The cache callback
      // only runs on a miss (at most once per 5s per slug), so bumping the
      // Manage panel's all-time listener-peak counter here stays cheap.
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
          const numClients = data.result?.num_clients ?? 0
          if (numClients > channel.listenerPeak) {
            await fastify.prisma.channel.update({
              where: { id: channel.id },
              data: { listenerPeak: numClients },
            })
          }
          return { numClients }
        } catch {
          return { numClients: 0 }
        }
      })
      return reply.send(result)
    },
  )

  // GET /api/channels/:slug/daily-listeners — distinct listeners so far today
  // (UTC), shown at the top of the chat panel — same anonymized-id-set counter
  // (M22, populated by a worker cron from HLS access logs) the artist's own
  // stats dashboard uses, not a new tracking mechanism.
  fastify.get(
    '/api/channels/:slug/daily-listeners',
    {
      schema: {
        tags: ['chat'],
        response: openApiResponse(ChatDailyListenersResponseSchema, 'ChatDailyListeners'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: { id: true, user: { select: { showDailyListeners: true } } },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const result = await getCachedJson(`daily-listeners:${slug}`, 60, async () => {
        const today = new Date().toISOString().slice(0, 10)
        const byDate = await fetchMeasuredHlsListenersByDate(slug, [today])
        return { count: byDate[today] ?? 0, enabled: channel.user.showDailyListeners }
      })
      return reply.send(result)
    },
  )
}

export default chatPresenceRoute
