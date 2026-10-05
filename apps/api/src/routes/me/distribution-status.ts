// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { AdminIntegrationsStatusSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { buildDistributionIntegrationsStatus } from '../../lib/distribution-integrations.js'

/** Artist-safe live/stub modes for Studio Distribution (no secrets). */
const meDistributionStatusRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/distribution/status',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        description:
          'Mixcloud + Revelator platform mode (live vs stub) for Studio Distribution banners',
        response: openApiResponse(AdminIntegrationsStatusSchema, 'MeDistributionStatus'),
      },
    },
    async (_request, reply) => {
      return reply.send(buildDistributionIntegrationsStatus())
    },
  )
}

export default meDistributionStatusRoutes
