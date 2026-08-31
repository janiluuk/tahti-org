// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { ImportPluginProviderListSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { IMPORT_PLUGIN_PROVIDERS } from '../../lib/import-plugin-providers.js'

const meImportPluginRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/import-plugins',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Versioned import-provider capabilities for external clients',
        response: openApiResponse(ImportPluginProviderListSchema, 'ImportPluginProviderList'),
      },
    },
    async (_request, reply) => reply.send({ providers: IMPORT_PLUGIN_PROVIDERS }),
  )
}

export default meImportPluginRoutes
