// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { AuditExportQuerySchema, CsvExportBodySchema, openApiResponse } from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { sendCsv } from '../../lib/csv.js'

// M11: board/treasurer audit log export for compliance review.
const adminAuditRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/audit/export.csv',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(CsvExportBodySchema, 'CsvExportBody'),
      },
    },
    async (request, reply) => {
      const parsed = AuditExportQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid query',
        })
      }
      const { since, until } = parsed.data
      const from = since ? new Date(since) : new Date(Date.now() - 90 * 86400_000)
      const to = until ? new Date(until) : new Date()

      const rows = await fastify.prisma.auditLog.findMany({
        where: { createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: 'asc' },
        take: 50_000,
      })

      return sendCsv(
        reply,
        'tahti-audit-log.csv',
        ['id', 'createdAt', 'action', 'actorId', 'targetId', 'meta'],
        rows.map((r) => [
          r.id.toString(),
          r.createdAt.toISOString(),
          r.action,
          r.actorId,
          r.targetId,
          JSON.stringify(r.meta ?? {}),
        ]),
      )
    },
  )
}

export default adminAuditRoutes
