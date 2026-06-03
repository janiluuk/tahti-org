// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { config } from '../../config.js'
import { liveHlsUrl } from '../../lib/stream-quality.js'

const channelGetRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/channels/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }

    const channel = await fastify.prisma.channel.findUnique({
      where: { slug },
      select: {
        slug: true,
        state: true,
        galleryMode: true,
        slideshowImages: true,
        textLayerMode: true,
        textLayerText: true,
        textLayerAlign: true,
        videoBackgroundUrl: true,
        user: {
          select: {
            username: true,
            displayName: true,
            bio: true,
            avatarUrl: true,
            tier: true,
          },
        },
      },
    })

    if (!channel) {
      return reply.status(404).send({ error: 'Channel not found' })
    }

    const hlsUrl =
      channel.state === 'LIVE'
        ? liveHlsUrl(config.hlsBaseUrl, channel.slug, channel.user.tier)
        : null

    return reply.send({ ...channel, hlsUrl })
  })
}

export default channelGetRoute
