// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ChannelManageStatsSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'
import { fetchMountSignalStatus } from '../../lib/icecast-status.js'
import { getCachedJson } from '../../lib/json-cache.js'

/** Owner/board-only stats snapshot for the channel page's "Manage" tab. Slug-scoped
 * (not /api/me/...) since a board member needs to view any artist's channel, not
 * just their own. */
const channelManageStatsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/channels/:slug/manage-stats',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Manage tab stats — owner or board only',
        response: openApiResponse(ChannelManageStatsSchema, 'ChannelManageStats'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: {
          id: true,
          state: true,
          goneLiveAt: true,
          liveSourceMount: true,
          listenerPeak: true,
          totalPlays: true,
          user: { select: { username: true } },
        },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const user = request.sessionUser!
      if (user.username !== channel.user.username && !user.isBoard) {
        return reply.status(403).send({ error: 'Not authorized to manage this channel' })
      }

      // Polled every 15s while the Manage tab is open — a short cache
      // collapses that poller (and a board member viewing the same channel
      // concurrently) into one round trip of counts/signal-status checks.
      const result = await getCachedJson(`manage-stats:${slug}`, 10, async () => {
        const [signal, presenceRes, likes, reposts, rotationTrackCount] = await Promise.all([
          channel.state === 'LIVE'
            ? fetchMountSignalStatus(config.icecastBaseUrl, channel.liveSourceMount)
            : Promise.resolve(null),
          fetch(`${config.apiUrl}/api/channels/${slug}/presence`)
            .then((r) => (r.ok ? r.json() : { numClients: 0 }))
            .catch(() => ({ numClients: 0 })),
          fastify.prisma.soundLike.count({
            where: { sound: { channelId: channel.id } },
          }),
          fastify.prisma.soundRepost.count({
            where: { sound: { channelId: channel.id } },
          }),
          fastify.prisma.sound.count({ where: { channelId: channel.id, isFallback: true } }),
        ])

        const liveDurationSec =
          channel.state === 'LIVE' && channel.goneLiveAt
            ? Math.max(0, Math.floor((Date.now() - channel.goneLiveAt.getTime()) / 1000))
            : null

        return {
          audioBitrateKbps: signal?.bitrateKbps ?? null,
          signalConnected: signal?.connected ?? false,
          listeners: (presenceRes as { numClients: number }).numClients,
          listenerPeak: channel.listenerPeak,
          plays: channel.totalPlays,
          likes,
          reposts,
          liveDurationSec,
          rotationTrackCount,
        }
      })

      return reply.send(result)
    },
  )
}

export default channelManageStatsRoute
