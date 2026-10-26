// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  StatsAudienceQuerySchema,
  StatsAudienceResponseSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { AUDIENCE_MIN_BUCKET, buildAudienceShares } from '../../lib/listen-audience.js'

/** Studio audience breakdown from listen sessions: shares only, never rows
 * about a single listener. */
const meStatsAudienceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/stats/audience',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description:
          'Share of listens by browser, OS, device type, device vendor or source (referrer host); names with fewer than 5 listens fold into Other',
        response: openApiResponse(StatsAudienceResponseSchema, 'StatsAudience'),
      },
    },
    async (request, reply) => {
      const parsed = StatsAudienceQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      }
      const { dimension, ...window } = parsed.data
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: request.sessionUser!.id },
        select: { id: true },
      })
      const shares = channel
        ? await buildAudienceShares(fastify.prisma, channel.id, dimension, window)
        : { total: 0, items: [] }
      return reply.send({ dimension, minBucket: AUDIENCE_MIN_BUCKET, ...shares })
    },
  )
}

export default meStatsAudienceRoutes
