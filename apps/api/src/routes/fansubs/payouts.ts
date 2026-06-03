// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'

const fanSubPayoutRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/me/fan-sub-payouts', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!

    const [pending, failed, paidRecent] = await Promise.all([
      fastify.prisma.fanSubPayout.count({
        where: { artistUserId: user.id, state: 'PENDING' },
      }),
      fastify.prisma.fanSubPayout.count({
        where: { artistUserId: user.id, state: 'FAILED' },
      }),
      fastify.prisma.fanSubPayout.count({
        where: {
          artistUserId: user.id,
          state: 'PAID',
          paidAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
        },
      }),
    ])

    return reply.send({ pending, failed, paidLast30Days: paidRecent })
  })
}

export default fanSubPayoutRoutes
