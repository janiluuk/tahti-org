// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'

const fanSubPayoutRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/me/fan-sub-payouts', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!

    const [pending, failed, paidRecent, recent, activeSubs] = await Promise.all([
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
      fastify.prisma.fanSubPayout.findMany({
        where: { artistUserId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          state: true,
          grossCents: true,
          netToArtistCents: true,
          forPeriodStart: true,
          forPeriodEnd: true,
          paidAt: true,
          createdAt: true,
          fanSubscription: { select: { tierName: true } },
        },
      }),
      fastify.prisma.fanSubscription.count({
        where: { artistUserId: user.id, state: 'ACTIVE' },
      }),
    ])

    return reply.send({
      pending,
      failed,
      paidLast30Days: paidRecent,
      activeSubscribers: activeSubs,
      recent: recent.map((p) => ({
        id: p.id,
        state: p.state,
        tierName: p.fanSubscription.tierName,
        grossCents: p.grossCents,
        netToArtistCents: p.netToArtistCents,
        forPeriodStart: p.forPeriodStart,
        forPeriodEnd: p.forPeriodEnd,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
    })
  })
}

export default fanSubPayoutRoutes
