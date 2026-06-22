// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AdminForceOfflineResponseSchema,
  openApiResponses,
  parseRouteParams,
  SlugParamSchema,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'
import { forceChannelOffline } from '../../lib/force-channel-offline.js'

// M21-C: force a live channel offline (orchestrator stop + broadcast end + audit)
const adminChannelsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/admin/channels/:slug/force-offline',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'M21-C: stop Liquidsoap, end broadcast, set channel OFFLINE',
        response: openApiResponses([
          { status: 200, schema: AdminForceOfflineResponseSchema, name: 'Ok' },
        ]),
      },
    },
    async (request, reply) => {
      const actor = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: { id: true, state: true, userId: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      if (channel.state === 'OFFLINE') {
        return reply.status(409).send({ error: 'Channel is not live' })
      }

      await forceChannelOffline(fastify.prisma, fastify.log, {
        channelId: channel.id,
        slug,
      })

      await auditLog(fastify.prisma, {
        action: 'STREAM_FORCE_OFFLINE',
        actorId: actor.id,
        targetId: channel.userId,
        meta: { channelId: channel.id, slug },
      })

      return reply.send({ ok: true as const, channelId: channel.id, slug })
    },
  )
}

export default adminChannelsRoutes
