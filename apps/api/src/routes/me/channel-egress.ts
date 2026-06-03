// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { ChannelEgressResponseSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { buildChannelEgressStats } from '../../lib/channel-egress-summary.js'

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
      return reply.send(await buildChannelEgressStats(fastify.prisma, user.id))
    },
  )
}

export default channelEgressRoutes
