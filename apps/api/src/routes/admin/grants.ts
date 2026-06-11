// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  CsvExportBodySchema,
  GrantPreviewResponseSchema,
  GrantRunResponseSchema,
  LedgerExportQuerySchema,
  openApiResponse,
  openApiResponses,
  yearFromPathParams,
} from '@tahti/shared'
import { buildGrantPreview, runAnnualGrantCalc } from '@tahti/ledger'
import { requireBoard } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'
import { sendCsv } from '../../lib/csv.js'

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
      const forYear = yearFromPathParams(request.params)
      if (forYear === null) {
        return reply.status(400).send({ error: 'Invalid year' })
      }
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
      const forYear = yearFromPathParams(request.params)
      if (forYear === null) {
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

  // GET /api/admin/grants/export.csv?year=YYYY — board CSV export of the
  // per-artist allocation preview (PLAT-048).
  fastify.get(
    '/api/admin/grants/export.csv',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'PLAT-048: per-artist grant allocation preview as CSV',
        response: openApiResponse(CsvExportBodySchema, 'CsvExportBody'),
      },
    },
    async (request, reply) => {
      const parsed = LedgerExportQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid year',
        })
      }
      const forYear = parsed.data.year ? parseInt(parsed.data.year, 10) : new Date().getFullYear()

      const preview = await buildGrantPreview(fastify.prisma, forYear)

      return sendCsv(
        reply,
        `tahti-grants-${forYear}.csv`,
        [
          'username',
          'displayName',
          'units',
          'freeDownloads',
          'paidDownloads',
          'fanSubEuros',
          'amountCents',
        ],
        preview.artists.map((a) => [
          a.username,
          a.displayName,
          a.units,
          a.freeDownloads,
          a.paidDownloads,
          a.fanSubEuros,
          a.amountCents,
        ]),
      )
    },
  )
}

export default adminGrantsRoutes
