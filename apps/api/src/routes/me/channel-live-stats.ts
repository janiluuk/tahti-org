// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { ChannelLiveStatsResponseSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { buildLiveDailySeries, LIVE_DAILY_SERIES_DAYS } from '../../lib/channel-live-daily.js'

/** M22: live broadcast duration funnel (until per-listener HLS metrics exist). */
const channelLiveStatsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/channel-live-stats',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M22: live broadcast seconds per UTC day (14-day series)',
        response: openApiResponse(ChannelLiveStatsResponseSchema, 'ChannelLiveStats'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })

      if (!channel) {
        return reply.send({
          windowDays: LIVE_DAILY_SERIES_DAYS,
          totalLiveSeconds: 0,
          totalBroadcasts: 0,
          daily: [],
        })
      }

      const daily = await buildLiveDailySeries(fastify.prisma, channel.id)
      const totalLiveSeconds = daily.reduce((s, d) => s + d.liveSeconds, 0)
      const totalBroadcasts = daily.reduce((s, d) => s + d.broadcastCount, 0)

      return reply.send({
        windowDays: LIVE_DAILY_SERIES_DAYS,
        totalLiveSeconds,
        totalBroadcasts,
        daily,
      })
    },
  )
}

export default channelLiveStatsRoutes
