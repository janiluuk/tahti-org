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
          nowPlayingTitle: true,
          nowPlayingArtistName: true,
          nowPlayingArtworkUrl: true,
          nowPlayingUpdatedAt: true,
          user: {
            select: {
              username: true,
              displayName: true,
              bio: true,
              avatarUrl: true,
              countryCode: true,
              pronouns: true,
              socialLinks: true,
              tier: true,
              showJoinDate: true,
              createdAt: true,
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

      const { showJoinDate, createdAt, ...userRest } = channel.user

      // Stale poller data (orchestrator down, channel not actually running) is
      // worse than none — a "now playing" that hasn't moved in minutes reads as
      // broken, not just outdated.
      const NOW_PLAYING_STALE_MS = 2 * 60 * 1000
      const nowPlayingFresh =
        channel.nowPlayingUpdatedAt != null &&
        Date.now() - channel.nowPlayingUpdatedAt.getTime() < NOW_PLAYING_STALE_MS
      const nowPlaying =
        nowPlayingFresh && channel.nowPlayingTitle && channel.nowPlayingArtistName
          ? {
              title: channel.nowPlayingTitle,
              artistName: channel.nowPlayingArtistName,
              artworkUrl: channel.nowPlayingArtworkUrl,
            }
          : null

      return reply.send({
        ...channel,
        user: {
          ...userRest,
          joinDate: showJoinDate ? createdAt.toISOString() : null,
        },
        nextBroadcastAt: channel.nextBroadcastAt?.toISOString() ?? null,
        hlsUrl,
        colorScheme: resolveColorScheme(channel.colorSchemeJson, null),
        nowPlaying,
      })
    },
  )
}

export default channelGetRoute
