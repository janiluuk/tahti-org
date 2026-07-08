// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { ChannelFunnelResponseSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { buildChannelLiveStats } from '../../lib/channel-live-summary.js'
import { buildDownloadGateStats } from '../../lib/download-gate-summary.js'

/**
 * M22: dashboard payload for download gates + live time.
 * PERF-006: egress used to be bundled here too, but the only consumer (the
 * dashboard overview page) only ever showed it inside a collapsed-by-default
 * detail panel — never a KPI — while still paying for a live Caddy-log read on
 * every visit. Use GET /api/me/channel-egress directly where egress is actually needed.
 */
const channelFunnelStatsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/channel-funnel-stats',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M22: combined channel funnel (gates + live)',
        response: openApiResponse(ChannelFunnelResponseSchema, 'ChannelFunnel'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const [downloadGates, live] = await Promise.all([
        buildDownloadGateStats(fastify.prisma, user.id),
        buildChannelLiveStats(fastify.prisma, user.id),
      ])
      return reply.send({ downloadGates, live })
    },
  )
}

export default channelFunnelStatsRoutes
