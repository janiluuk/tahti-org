// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireBoard } from '../../plugins/auth.js'
import { csvRow } from '../../lib/csv.js'

// M11: board/treasurer audit log export for compliance review.
const adminAuditRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/audit/export.csv',
    { preHandler: requireBoard },
    async (request, reply) => {
      const { since, until } = request.query as { since?: string; until?: string }
      const from = since ? new Date(since) : new Date(Date.now() - 90 * 86400_000)
      const to = until ? new Date(until) : new Date()

      const rows = await fastify.prisma.auditLog.findMany({
        where: { createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: 'asc' },
        take: 50_000,
      })

      const header = csvRow(['id', 'createdAt', 'action', 'actorId', 'targetId', 'meta'])
      const lines = rows.map((r) =>
        csvRow([
          r.id.toString(),
          r.createdAt.toISOString(),
          r.action,
          r.actorId,
          r.targetId,
          JSON.stringify(r.meta ?? {}),
        ]),
      )

      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="tahti-audit-log.csv"')
        .send([header, ...lines].join('\n'))
    },
  )
}

export default adminAuditRoutes
