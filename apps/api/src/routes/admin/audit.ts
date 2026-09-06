// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { AuditAction, Prisma } from '@tahti/db'
import {
  AdminAuditListQuerySchema,
  AdminAuditListResponseSchema,
  AuditExportQuerySchema,
  CsvExportBodySchema,
  actionsForGovernanceAuditTopic,
  openApiResponse,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { sendCsv } from '../../lib/csv.js'
import { presentAuditLogRow } from '../../lib/audit.js'

function auditActionWhere(
  scope: 'governance' | 'all',
  topic: string | undefined,
  action: string | undefined,
): { error: string } | { where: Prisma.AuditLogWhereInput } {
  if (action) {
    if (scope !== 'all') {
      const allowed = actionsForGovernanceAuditTopic(topic)
      if (!allowed) return { error: 'Unknown audit topic' }
      if (!allowed.includes(action)) {
        return { error: 'Action is not a governance audit action' }
      }
    }
    return { where: { action: action as AuditAction } }
  }
  if (scope === 'all' && !topic) {
    return { where: {} }
  }
  const actions = actionsForGovernanceAuditTopic(topic)
  if (!actions) return { error: 'Unknown audit topic' }
  return { where: { action: { in: [...actions] as AuditAction[] } } }
}

// M11: board/treasurer audit log export for compliance review.
const adminAuditRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/audit',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'Paginated governance audit log for the board viewer',
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
      const { page, limit, action, actorId, targetId, since, until, topic, scope } = parsed.data
      const actionFilter = auditActionWhere(scope, topic, action)
      if ('error' in actionFilter) {
        return reply.status(400).send({ error: actionFilter.error })
      }

      const where: Prisma.AuditLogWhereInput = { ...actionFilter.where }
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
        items: rows.map((r) => presentAuditLogRow(r, actorMap.get(r.actorId))),
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
      const { since, until, topic, scope } = parsed.data
      const from = since ? new Date(since) : new Date(Date.now() - 90 * 86400_000)
      const to = until ? new Date(until) : new Date()
      const actionFilter = auditActionWhere(scope, topic, undefined)
      if ('error' in actionFilter) {
        return reply.status(400).send({ error: actionFilter.error })
      }

      const rows = await fastify.prisma.auditLog.findMany({
        where: {
          ...actionFilter.where,
          createdAt: { gte: from, lte: to },
        },
        orderBy: { createdAt: 'asc' },
        take: 50_000,
      })

      return sendCsv(
        reply,
        'tahti-governance-audit.csv',
        ['id', 'createdAt', 'topic', 'action', 'actorId', 'targetId', 'meta'],
        rows.map((r) => {
          const presented = presentAuditLogRow(r)
          return [
            presented.id,
            presented.createdAt.toISOString(),
            presented.topic ?? '',
            presented.action,
            presented.actorId,
            presented.targetId,
            JSON.stringify(presented.meta),
          ]
        }),
      )
    },
  )
}

export default adminAuditRoutes
