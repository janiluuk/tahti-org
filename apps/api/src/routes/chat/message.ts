// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'

// Centrifugo proxy publish webhook.
// Centrifugo calls this before allowing a client to publish.
// We check if the sender is banned and validate message length.
const chatMessageRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/chat/:slug/message', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const body = request.body as {
      client?: string
      user?: string
      channel?: string
      data?: { text?: string }
    }

    const sub = body.user ?? ''
    const fingerprint = sub.split('#')[1] ?? ''
    const text = body.data?.text ?? ''

    if (text.length > 500) {
      return reply.status(400).send({ error: 'message too long' })
    }

    const channel = await fastify.prisma.channel.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!channel) return reply.status(404).send({ error: 'channel not found' })

    if (fingerprint) {
      const ban = await fastify.prisma.chatBan.findUnique({
        where: {
          channelId_fingerprintHash: { channelId: channel.id, fingerprintHash: fingerprint },
        },
      })
      if (ban) return reply.status(403).send({ error: 'banned' })
    }

    // Return the data as-is — Centrifugo publishes it
    return reply.send({ result: {} })
  })
}

export default chatMessageRoute
