// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'

// Public: GET announcements for a channel
const chatAnnouncementsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/chat/:slug/announcements', async (request, reply) => {
    const { slug } = request.params as { slug: string }

    const channel = await fastify.prisma.channel.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!channel) return reply.status(404).send({ error: 'Channel not found' })

    const announcements = await fastify.prisma.channelAnnouncement.findMany({
      where: { channelId: channel.id },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, body: true, createdAt: true },
    })

    return reply.send(announcements)
  })
}

export default chatAnnouncementsRoute
