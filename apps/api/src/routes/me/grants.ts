// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'

// M9 — an artist's own grant disbursements across years.
const meGrantsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/me/grants', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!

    const grants = await fastify.prisma.grantDisbursement.findMany({
      where: { userId: user.id },
      orderBy: { forYear: 'desc' },
      select: {
        forYear: true,
        units: true,
        amountCents: true,
        state: true,
        notifiedAt: true,
        confirmedAt: true,
        paidAt: true,
      },
    })

    return reply.send(
      grants.map((g) => ({
        ...g,
        amountCents: g.amountCents.toString(),
      })),
    )
  })
}

export default meGrantsRoutes
