// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { computeEngagementUnits } from '@tahti/ledger'
import {
  AdminUserEngagementQuerySchema,
  AdminUserEngagementSchema,
  EngagementAdjustmentResponseSchema,
  EngagementAdjustmentSchema,
  IdParamSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'

const adminEngagementRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/users/:id/engagement',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminUserEngagementSchema, 'AdminUserEngagement'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const parsed = AdminUserEngagementQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid query',
        })
      }
      const year = parsed.data.year ?? new Date().getUTCFullYear()

      const user = await fastify.prisma.user.findUnique({ where: { id }, select: { id: true } })
      if (!user) return reply.status(404).send({ error: 'User not found' })

      const rows = await computeEngagementUnits(fastify.prisma, year)
      const baseUnits = rows.find((r) => r.userId === id)?.units ?? 0

      const adjustmentLogs = await fastify.prisma.auditLog.findMany({
        where: {
          action: 'ENGAGEMENT_ADJUSTMENT',
          targetId: id,
          createdAt: {
            gte: new Date(Date.UTC(year, 0, 1)),
            lt: new Date(Date.UTC(year + 1, 0, 1)),
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })

      const adjustments = adjustmentLogs.map((log) => {
        const meta = (log.meta ?? {}) as { units?: number; reason?: string }
        return {
          units: meta.units ?? 0,
          reason: meta.reason ?? '',
          createdAt: log.createdAt,
          actorId: log.actorId,
        }
      })
      const adjustmentTotal = adjustments.reduce((sum, a) => sum + a.units, 0)

      return reply.send({
        userId: id,
        year,
        totalUnits: baseUnits + adjustmentTotal,
        adjustments,
      })
    },
  )

  fastify.post(
    '/api/admin/engagement/adjustment',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponses([
          {
            status: 200,
            schema: EngagementAdjustmentResponseSchema,
            name: 'EngagementAdjustmentResponse',
          },
        ]),
      },
    },
    async (request, reply) => {
      const actor = request.sessionUser!
      const parsed = EngagementAdjustmentSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }
      const { userId, units, reason } = parsed.data
      const year = parsed.data.year ?? new Date().getUTCFullYear()

      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      })
      if (!user) return reply.status(404).send({ error: 'User not found' })

      await auditLog(fastify.prisma, {
        action: 'ENGAGEMENT_ADJUSTMENT',
        actorId: actor.id,
        targetId: userId,
        meta: { units, reason, year },
      })

      return reply.send({ ok: true as const, userId, units, year })
    },
  )
}

export default adminEngagementRoutes
