// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'

const channelGetRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/channels/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }

    const channel = await fastify.prisma.channel.findUnique({
      where: { slug },
      select: {
        slug: true,
        state: true,
        user: {
          select: {
            username: true,
            displayName: true,
            bio: true,
            avatarUrl: true,
          },
        },
      },
    })

    if (!channel) {
      return reply.status(404).send({ error: 'Channel not found' })
    }

    return reply.send(channel)
  })
}

export default channelGetRoute
