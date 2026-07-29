// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { StorageQuotaViewSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { getOrCreateQuota } from '../../lib/storage-quota.js'

const meStorageRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/storage',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Current user’s R2 storage quota + usage',
        response: openApiResponse(StorageQuotaViewSchema, 'StorageQuota'),
      },
    },
    async (request, reply) => {
      const quota = await getOrCreateQuota(fastify.prisma, request.sessionUser!.id)
      return reply.send({
        quotaBytes: Number(quota.quotaBytes),
        usedBytes: Number(quota.usedBytes),
      })
    },
  )
}

export default meStorageRoutes
