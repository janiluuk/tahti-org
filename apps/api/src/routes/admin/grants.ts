// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { runAnnualGrantCalc } from '@tahti/ledger'
import { requireBoard } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'

// M9 — board-triggered annual grant calculation. The same routine runs on the
// March 1 cron in the worker; this endpoint lets the board run/preview it.
const adminGrantsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/admin/grants/run/:year',
    { preHandler: requireBoard },
    async (request, reply) => {
      const user = request.sessionUser!
      const { year } = request.params as { year: string }
      const forYear = parseInt(year, 10)
      if (Number.isNaN(forYear)) {
        return reply.status(400).send({ error: 'Invalid year' })
      }

      const summary = await runAnnualGrantCalc(fastify.prisma, forYear)

      if (summary.alreadyRun) {
        return reply.status(409).send({
          error: `Grants for ${forYear} have already been calculated`,
        })
      }

      await auditLog(fastify.prisma, {
        action: 'GRANT_RUN',
        actorId: user.id,
        targetId: String(forYear),
        meta: {
          grantCount: summary.grantCount,
          poolCents: summary.poolCents,
          reserveCents: summary.reserveCents,
        },
      })

      return reply.status(201).send({
        ...summary,
        surplusCents: summary.surplusCents,
      })
    },
  )
}

export default adminGrantsRoutes
