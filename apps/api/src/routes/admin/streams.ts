// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { AdminLiveStreamListSchema, openApiResponse } from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'

// M21-C: live channel overview for admin stream manager
const adminStreamsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/streams',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'M21-C: channels currently LIVE',
        response: openApiResponse(AdminLiveStreamListSchema, 'AdminLiveStreamList'),
      },
    },
    async (_request, reply) => {
      const now = Date.now()
      const live = await fastify.prisma.channel.findMany({
        where: { state: 'LIVE' },
        orderBy: { goneLiveAt: 'asc' },
        select: {
          id: true,
          slug: true,
          goneLiveAt: true,
          user: { select: { displayName: true, username: true } },
        },
      })

      const streams = live.map((ch) => ({
        channelId: ch.id,
        slug: ch.slug,
        artistName: ch.user.displayName,
        username: ch.user.username,
        goneLiveAt: ch.goneLiveAt,
        elapsedSec: ch.goneLiveAt
          ? Math.max(0, Math.floor((now - ch.goneLiveAt.getTime()) / 1000))
          : 0,
      }))

      return reply.send({ count: streams.length, streams })
    },
  )
}

export default adminStreamsRoutes
