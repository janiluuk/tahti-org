// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { ChannelEgressResponseSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { buildEgressDailySeries, EGRESS_DAILY_SERIES_DAYS } from '../../lib/channel-egress-daily.js'

/** STREAM-006: download egress attributed to the artist channel (grant/cost visibility). */
const channelEgressRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/channel-egress',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'STREAM-006: attributed download egress (30-day UTC series)',
        response: openApiResponse(ChannelEgressResponseSchema, 'ChannelEgress'),
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
          windowDays: EGRESS_DAILY_SERIES_DAYS,
          totalBytes: 0,
          totalDownloads: 0,
          daily: [],
        })
      }

      const since = new Date(
        Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          new Date().getUTCDate() - (EGRESS_DAILY_SERIES_DAYS - 1),
        ),
      )

      const [agg, daily] = await Promise.all([
        fastify.prisma.download.aggregate({
          where: { channelId: channel.id, createdAt: { gte: since } },
          _sum: { bytes: true },
          _count: { _all: true },
        }),
        buildEgressDailySeries(fastify.prisma, channel.id),
      ])

      return reply.send({
        windowDays: EGRESS_DAILY_SERIES_DAYS,
        totalBytes: agg._sum.bytes ?? 0,
        totalDownloads: agg._count._all,
        daily,
      })
    },
  )
}

export default channelEgressRoutes
