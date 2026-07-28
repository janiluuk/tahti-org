// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  RtmpTargetStatusListSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { fetchRtmpTargetStatuses } from '../../lib/orchestrator.js'

/** Owner/board-only multistream status for the channel page's "Manage" tab —
 * slug-scoped like manage-stats.ts and transport.ts, for the same reason
 * (board members manage any channel, not just their own). */
const channelRtmpStatusRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/channels/:slug/rtmp-status',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Manage tab multistream (RTMP push) status — owner or board only',
        response: openApiResponse(RtmpTargetStatusListSchema, 'RtmpTargetStatusList'),
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
          user: { select: { username: true } },
          rtmpTargets: {
            select: { id: true, provider: true, label: true, enabled: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const user = request.sessionUser!
      if (user.username !== channel.user.username && !user.isBoard) {
        return reply.status(403).send({ error: 'Not authorized to manage this channel' })
      }

      const enabledIds = channel.rtmpTargets.filter((t) => t.enabled).map((t) => t.id)
      const liveStatuses = await fetchRtmpTargetStatuses(channel.id, enabledIds)

      return reply.send(
        channel.rtmpTargets.map((t) => ({
          id: t.id,
          provider: t.provider,
          label: t.label,
          enabled: t.enabled,
          ...(t.enabled
            ? (liveStatuses[t.id] ?? { status: 'offline' as const })
            : { status: 'disabled' as const }),
        })),
      )
    },
  )
}

export default channelRtmpStatusRoute
