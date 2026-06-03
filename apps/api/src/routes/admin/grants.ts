// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  GrantPreviewResponseSchema,
  GrantRunResponseSchema,
  YearPathParamSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { buildGrantPreview, runAnnualGrantCalc } from '@tahti/ledger'
import { requireBoard } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'

// M9 — board-triggered annual grant calculation. The same routine runs on the
// March 1 cron in the worker; this endpoint lets the board run/preview it.
const adminGrantsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/grants/preview/:year',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'DIRECTOR-001: dry-run grant split with per-artist anomaly flags',
        response: openApiResponse(GrantPreviewResponseSchema, 'GrantPreview'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(YearPathParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid year' })
      const forYear = parseInt(routeParams.year, 10)
      const preview = await buildGrantPreview(fastify.prisma, forYear)
      return reply.send(preview)
    },
  )

  fastify.post(
    '/api/admin/grants/run/:year',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'M9: run annual grant calculation for a calendar year',
        response: openApiResponses([
          { status: 201, schema: GrantRunResponseSchema, name: 'GrantRun' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(YearPathParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid year' })
      const forYear = parseInt(routeParams.year, 10)

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
