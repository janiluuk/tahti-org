// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { ChannelFunnelResponseSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { buildChannelEgressStats } from '../../lib/channel-egress-summary.js'
import { buildChannelLiveStats } from '../../lib/channel-live-summary.js'
import { buildDownloadGateStats } from '../../lib/download-gate-summary.js'

/** M22: single dashboard payload for download gates, live time, and egress. */
const channelFunnelStatsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/channel-funnel-stats',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M22: combined channel funnel (gates + live + egress)',
        response: openApiResponse(ChannelFunnelResponseSchema, 'ChannelFunnel'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const [downloadGates, live, egress] = await Promise.all([
        buildDownloadGateStats(fastify.prisma, user.id),
        buildChannelLiveStats(fastify.prisma, user.id),
        buildChannelEgressStats(fastify.prisma, user.id),
      ])
      return reply.send({ downloadGates, live, egress })
    },
  )
}

export default channelFunnelStatsRoutes
