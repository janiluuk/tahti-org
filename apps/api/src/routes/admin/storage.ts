// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { AdminStorageOverviewSchema, openApiResponse } from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'

const adminStorageRoutes: FastifyPluginAsync = async (fastify) => {
  // Overall R2 usage across the platform + a per-user breakdown. R2 doesn't
  // have unlimited real-time analytics without the Cloudflare account API
  // (R2_API_TOKEN, separate from the S3 credentials) — this reports what we
  // track ourselves in UserStorageQuota, which is authoritative for quota
  // enforcement even if it lags Cloudflare's own dashboard slightly.
  fastify.get(
    '/api/admin/storage',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminStorageOverviewSchema, 'AdminStorageOverview'),
      },
    },
    async (_request, reply) => {
      const rows = await fastify.prisma.userStorageQuota.findMany({
        orderBy: { usedBytes: 'desc' },
        select: {
          quotaBytes: true,
          usedBytes: true,
          user: { select: { id: true, username: true, displayName: true } },
        },
      })

      let totalQuotaBytes = 0
      let totalUsedBytes = 0
      const users = rows.map((row) => {
        totalQuotaBytes += Number(row.quotaBytes)
        totalUsedBytes += Number(row.usedBytes)
        return {
          userId: row.user.id,
          username: row.user.username,
          displayName: row.user.displayName,
          quotaBytes: Number(row.quotaBytes),
          usedBytes: Number(row.usedBytes),
        }
      })

      return reply.send({
        totalQuotaBytes,
        totalUsedBytes,
        userCount: users.length,
        users,
      })
    },
  )
}

export default adminStorageRoutes
