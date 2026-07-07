// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@tahti/db'
import {
  AdminContentReportListQuerySchema,
  AdminContentReportListSchema,
  AdminContentReportPatchSchema,
  AdminContentReportRowSchema,
  ContentReportIdParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'

function mapReportRow(report: {
  id: bigint
  targetType: string
  targetId: string
  reason: string
  details: string | null
  status: string
  resolvedById: string | null
  resolutionNote: string | null
  resolvedAt: Date | null
  createdAt: Date
  resolvedBy: { displayName: string } | null
}) {
  return {
    id: report.id.toString(),
    targetType: report.targetType,
    targetId: report.targetId,
    reason: report.reason,
    details: report.details,
    status: report.status,
    resolvedById: report.resolvedById,
    resolvedByDisplayName: report.resolvedBy?.displayName ?? null,
    resolutionNote: report.resolutionNote,
    resolvedAt: report.resolvedAt,
    createdAt: report.createdAt,
  }
}

const adminContentReportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/content-reports',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminContentReportListSchema, 'AdminContentReportList'),
      },
    },
    async (request, reply) => {
      const parsed = AdminContentReportListQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid query' })
      }
      const { page, limit, status } = parsed.data
      const where: Prisma.ContentReportWhereInput = {}
      if (status) where.status = status

      const [total, rows] = await Promise.all([
        fastify.prisma.contentReport.count({ where }),
        fastify.prisma.contentReport.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { resolvedBy: { select: { displayName: true } } },
        }),
      ])

      return reply.send({ page, limit, total, reports: rows.map(mapReportRow) })
    },
  )

  fastify.get(
    '/api/admin/content-reports/:id',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminContentReportRowSchema, 'AdminContentReportRow'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(ContentReportIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const report = await fastify.prisma.contentReport.findUnique({
        where: { id: routeParams.id },
        include: { resolvedBy: { select: { displayName: true } } },
      })
      if (!report) return reply.status(404).send({ error: 'Report not found' })

      return reply.send(mapReportRow(report))
    },
  )

  fastify.patch(
    '/api/admin/content-reports/:id',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminContentReportRowSchema, 'AdminContentReportRow'),
      },
    },
    async (request, reply) => {
      const actor = request.sessionUser!
      const routeParams = parseRouteParams(ContentReportIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const parsed = AdminContentReportPatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' })
      }

      const existing = await fastify.prisma.contentReport.findUnique({
        where: { id: routeParams.id },
      })
      if (!existing) return reply.status(404).send({ error: 'Report not found' })

      const isResolving = parsed.data.status === 'ACTIONED' || parsed.data.status === 'DISMISSED'

      const report = await fastify.prisma.contentReport.update({
        where: { id: routeParams.id },
        data: {
          ...parsed.data,
          ...(isResolving
            ? { resolvedById: actor.id, resolvedAt: new Date() }
            : parsed.data.status
              ? { resolvedById: null, resolvedAt: null }
              : {}),
        },
        include: { resolvedBy: { select: { displayName: true } } },
      })

      return reply.send(mapReportRow(report))
    },
  )
}

export default adminContentReportRoutes
