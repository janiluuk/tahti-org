// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { ChannelLiveStatsResponseSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { buildChannelLiveStats } from '../../lib/channel-live-summary.js'

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
      return reply.send(await buildChannelLiveStats(fastify.prisma, user.id))
    },
  )
}

export default channelLiveStatsRoutes
