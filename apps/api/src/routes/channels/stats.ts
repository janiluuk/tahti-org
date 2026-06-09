// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'

const channelStatsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/stats',
    {
      schema: {
        tags: ['channel'],
        description: 'Public platform stats — active artists, broadcasts this month, total hours',
        response: {
          200: {
            type: 'object',
            properties: {
              activeArtists: { type: 'integer' },
              broadcastsThisMonth: { type: 'integer' },
              totalHours: { type: 'number' },
            },
            required: ['activeArtists', 'broadcastsThisMonth', 'totalHours'],
          },
        },
      },
    },
    async (_request, reply) => {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      const [activeArtists, broadcastsThisMonth, hoursAgg] = await Promise.all([
        fastify.prisma.channel.count({
          where: { broadcasts: { some: {} } },
        }),
        fastify.prisma.broadcast.count({
          where: { startedAt: { gte: monthStart } },
        }),
        fastify.prisma.channel.aggregate({
          _sum: { totalLiveHours: true },
        }),
      ])

      return reply.send({
        activeArtists,
        broadcastsThisMonth,
        totalHours: Math.round(hoursAgg._sum.totalLiveHours ?? 0),
      })
    },
  )
}

export default channelStatsRoute
