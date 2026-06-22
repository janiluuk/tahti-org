// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  PublicChannelViewSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { config } from '../../config.js'
import { liveHlsUrl } from '../../lib/stream-quality.js'
import { resolveColorScheme } from '@tahti/shared'

const channelGetRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/channels/:slug',
    {
      schema: {
        tags: ['channel'],
        description: 'Public channel page payload (LISTENER-002 schedule + HLS when live)',
        response: openApiResponse(PublicChannelViewSchema, 'PublicChannel'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: {
          slug: true,
          state: true,
          nextBroadcastAt: true,
          nextBroadcastNote: true,
          galleryMode: true,
          slideshowImages: true,
          textLayerMode: true,
          textLayerText: true,
          textLayerAlign: true,
          videoBackgroundUrl: true,
          colorSchemeJson: true,
          visualPreset: true,
          slideshowPreset: true,
          slideshowIntervalSeconds: true,
          slideshowTransitionMs: true,
          slideshowAutoplay: true,
          user: {
            select: {
              username: true,
              displayName: true,
              bio: true,
              avatarUrl: true,
              countryCode: true,
              socialLinks: true,
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

      return reply.send({
        ...channel,
        nextBroadcastAt: channel.nextBroadcastAt?.toISOString() ?? null,
        hlsUrl,
        colorScheme: resolveColorScheme(channel.colorSchemeJson, null),
      })
    },
  )
}

export default channelGetRoute
