// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { AuditAction, Prisma } from '@tahti/db'
import {
  AdminAuditListQuerySchema,
  AdminAuditListResponseSchema,
  AuditExportQuerySchema,
  CsvExportBodySchema,
  openApiResponse,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { sendCsv } from '../../lib/csv.js'

// M11: board/treasurer audit log export for compliance review.
const adminAuditRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/audit',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'M21-G: paginated audit log for admin viewer',
        response: openApiResponse(AdminAuditListResponseSchema, 'AdminAuditListResponse'),
      },
    },
    async (request, reply) => {
      const parsed = AdminAuditListQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid query',
        })
      }
      const { page, limit, action, actorId, targetId, since, until } = parsed.data

      const where: Prisma.AuditLogWhereInput = {}
      if (action) where.action = action as AuditAction
      if (actorId) where.actorId = actorId
      if (targetId) where.targetId = targetId
      if (since || until) {
        where.createdAt = {}
        if (since) where.createdAt.gte = new Date(since)
        if (until) where.createdAt.lte = new Date(until)
      }

      const [total, rows] = await Promise.all([
        fastify.prisma.auditLog.count({ where }),
        fastify.prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ])

      const actorIds = [...new Set(rows.map((r) => r.actorId))]
      const actors =
        actorIds.length > 0
          ? await fastify.prisma.user.findMany({
              where: { id: { in: actorIds } },
              select: { id: true, displayName: true, username: true },
            })
          : []
      const actorMap = new Map(actors.map((u) => [u.id, u]))

      return reply.send({
        page,
        limit,
        total,
        items: rows.map((r) => {
          const actor = actorMap.get(r.actorId)
          return {
            id: r.id.toString(),
            action: r.action,
            actorId: r.actorId,
            targetId: r.targetId,
            meta: (r.meta ?? {}) as Record<string, unknown>,
            createdAt: r.createdAt,
            actorDisplayName: actor?.displayName ?? null,
            actorUsername: actor?.username ?? null,
          }
        }),
      })
    },
  )

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
