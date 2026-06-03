// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { config } from '../../config.js'

const chatPresenceRoute: FastifyPluginAsync = async (fastify) => {
  // GET /api/channels/:slug/presence — listener count from Centrifugo
  fastify.get('/api/channels/:slug/presence', async (request, reply) => {
    const { slug } = request.params as { slug: string }

    const channel = await fastify.prisma.channel.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!channel) return reply.status(404).send({ error: 'Channel not found' })

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

      if (!res.ok) return reply.send({ numClients: 0 })

      const data = (await res.json()) as { result?: { num_clients?: number } }
      return reply.send({ numClients: data.result?.num_clients ?? 0 })
    } catch {
      return reply.send({ numClients: 0 })
    }
  })
}

export default chatPresenceRoute
