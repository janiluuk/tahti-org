// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { AdminIntegrationsStatusSchema, openApiResponse } from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { buildDistributionIntegrationsStatus } from '../../lib/distribution-integrations.js'

const adminIntegrationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/integrations',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'PLAT-056/057: Mixcloud + Revelator go-live configuration status',
        response: openApiResponse(AdminIntegrationsStatusSchema, 'AdminIntegrationsStatus'),
      },
    },
    async (_request, reply) => {
      return reply.send(buildDistributionIntegrationsStatus())
    },
  )
}

export default adminIntegrationsRoutes
