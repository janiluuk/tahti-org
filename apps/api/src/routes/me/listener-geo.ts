// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../../plugins/auth.js'
import { buildListenerGeo } from '../../lib/listener-geo.js'

const QuerySchema = z.object({
  period: z.enum(['7d', '30d', 'all']).default('30d'),
})

// PLAT-064: listener geography endpoint — aggregates Download.countryCode + HLS Redis geo hashes.
const meListenerGeoRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/listener-geo',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['stats'],
        description: 'PLAT-064: per-country listener counts (downloads + HLS plays)',
      },
    },
    async (request, reply) => {
      const parsed = QuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid period' })
      }
      const user = request.sessionUser!
      const geo = await buildListenerGeo(fastify.prisma, user.id, parsed.data.period)
      return reply.send({ period: parsed.data.period, geo })
    },
  )
}

export default meListenerGeoRoutes
