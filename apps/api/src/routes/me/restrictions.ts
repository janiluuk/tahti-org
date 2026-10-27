// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { MyAccountRestrictionListSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const meRestrictionsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/restrictions — the board's active restrictions on the caller,
  // so Studio can say why an upload or booking is refused before it is tried.
  // Who issued it stays on the board side.
  fastify.get(
    '/api/me/restrictions',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['settings'],
        response: openApiResponse(MyAccountRestrictionListSchema, 'MyAccountRestrictionList'),
      },
    },
    async (request, reply) => {
      const rows = await fastify.prisma.accountRestriction.findMany({
        where: {
          userId: request.sessionUser!.id,
          liftedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { bannedAt: 'desc' },
        select: { type: true, reason: true, expiresAt: true },
      })
      return reply.send({
        restrictions: rows.map((row) => ({
          type: row.type,
          reason: row.reason,
          expiresAt: row.expiresAt?.toISOString() ?? null,
        })),
      })
    },
  )
}

export default meRestrictionsRoutes
