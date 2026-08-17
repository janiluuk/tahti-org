// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { StorageQuotaViewSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { computeUserStorageUsedBytes } from '../../lib/user-storage.js'

const meStorageRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/storage',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        // docs/storage-policy.md: "quotaBytes" here is the soft *display*
        // target (default 500MB, same for every tier — Tahti doesn't scale
        // storage by plan), not an enforced cap. Nothing blocks uploads past
        // it; see storage-quota.ts's now-unused hard-cap model for what NOT
        // to wire this up to again.
        description: "Current user's storage soft target + live usage (non-enforcing)",
        response: openApiResponse(StorageQuotaViewSchema, 'StorageQuota'),
      },
    },
    async (request, reply) => {
      const [user, usedBytes] = await Promise.all([
        fastify.prisma.user.findUnique({
          where: { id: request.sessionUser!.id },
          select: { softTargetBytes: true, isMember: true },
        }),
        computeUserStorageUsedBytes(fastify.prisma, request.sessionUser!.id),
      ])
      return reply.send({
        quotaBytes: Number(user!.softTargetBytes),
        usedBytes: Number(usedBytes),
        // Members don't even get the soft-target nudge — just their usage.
        unlimited: user!.isMember,
      })
    },
  )
}

export default meStorageRoutes
