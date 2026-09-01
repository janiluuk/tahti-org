// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { ApiVersionResponseSchema, openApiResponse } from '@tahti/shared'
import { config } from '../config.js'

const versionRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/version',
    {
      schema: {
        tags: ['compliance'],
        description: 'Current Tahti release version for support and deployment checks',
        response: openApiResponse(ApiVersionResponseSchema, 'ApiVersion'),
      },
    },
    async (_request, reply) => reply.send({ version: config.releaseVersion }),
  )
}

export default versionRoute
