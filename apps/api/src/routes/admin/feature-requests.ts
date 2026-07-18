// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@tahti/db'
import {
  AdminFeatureRequestListSchema,
  AdminFeatureRequestRowSchema,
  FeatureRequestQuarterlyReportGeneratedSchema,
  FeatureRequestQuarterlyReportListSchema,
  FeatureRequestStatusSchema,
  GenerateFeatureRequestQuarterlyReportSchema,
  IdParamSchema,
  PatchFeatureRequestSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'
import {
  assembleFeatureRequestQuarterlyReportMarkdown,
  currentQuarter,
  featureRequestQuarterlyReportStorageKey,
} from '../../lib/feature-request-report.js'
import { presignedGetUrl, putObjectText } from '../../lib/minio.js'

const adminFeatureRequestRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/admin/feature-requests?status=
  fastify.get(
    '/api/admin/feature-requests',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminFeatureRequestListSchema, 'AdminFeatureRequestList'),
      },
    },
    async (request, reply) => {
      const query = request.query as { status?: string }
      const where: Prisma.FeatureRequestWhereInput = {}
      const statusParsed = FeatureRequestStatusSchema.safeParse(query.status)
      if (statusParsed.success) where.status = statusParsed.data

      const rows = await fastify.prisma.featureRequest.findMany({
        where,
        orderBy: [{ votes: { _count: 'desc' } }, { createdAt: 'desc' }],
        include: {
          proposedBy: { select: { displayName: true, username: true } },
          mergedInto: { select: { title: true } },
          _count: { select: { votes: true, comments: true } },
        },
      })

      return reply.send(
        rows.map((f) => ({
          id: f.id,
          title: f.title,
          description: f.description,
          status: f.status,
          proposer: f.proposedBy.displayName,
          proposerUsername: f.proposedBy.username,
          voteCount: f._count.votes,
          youVoted: false,
          commentCount: f._count.comments,
          reviewNote: f.reviewNote,
          reviewedAt: f.reviewedAt,
          mergedIntoId: f.mergedIntoId,
          mergedIntoTitle: f.mergedInto?.title ?? null,
          createdAt: f.createdAt,
        })),
      )
    },
  )

  // PATCH /api/admin/feature-requests/:id — quarterly review: set status, note,
  // or close as duplicate (mergedIntoId). Moving to PLANNED/IN_PROGRESS/DONE for
  // the first time stamps votedInYear/votedInQuarter — the "voted in" record.
  fastify.patch(
    '/api/admin/feature-requests/:id',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminFeatureRequestRowSchema, 'AdminFeatureRequestRow'),
      },
    },
    async (request, reply) => {
      const actor = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const parsed = PatchFeatureRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const existing = await fastify.prisma.featureRequest.findUnique({ where: { id } })
      if (!existing) return reply.status(404).send({ error: 'Feature request not found' })

      const data: Prisma.FeatureRequestUpdateInput = {
        reviewedBy: { connect: { id: actor.id } },
        reviewedAt: new Date(),
      }
      if (parsed.data.reviewNote !== undefined) data.reviewNote = parsed.data.reviewNote

      if (parsed.data.mergedIntoId !== undefined) {
        if (parsed.data.mergedIntoId === null) {
          data.mergedInto = { disconnect: true }
          if (existing.status === 'DUPLICATE') data.status = 'OPEN'
        } else {
          if (parsed.data.mergedIntoId === id) {
            return reply.status(400).send({ error: 'Cannot merge a request into itself' })
          }
          const target = await fastify.prisma.featureRequest.findUnique({
            where: { id: parsed.data.mergedIntoId },
            select: { id: true },
          })
          if (!target) return reply.status(400).send({ error: 'Merge target not found' })
          data.mergedInto = { connect: { id: parsed.data.mergedIntoId } }
          data.status = 'DUPLICATE'
        }
      } else if (parsed.data.status) {
        data.status = parsed.data.status
      }

      const willVoteIn =
        !existing.votedInYear &&
        (data.status === 'PLANNED' || data.status === 'IN_PROGRESS' || data.status === 'DONE')
      if (willVoteIn) {
        const { year, quarter } = currentQuarter()
        data.votedInYear = year
        data.votedInQuarter = quarter
      }

      const updated = await fastify.prisma.featureRequest.update({
        where: { id },
        data,
        include: {
          proposedBy: { select: { displayName: true, username: true } },
          mergedInto: { select: { title: true } },
          _count: { select: { votes: true, comments: true } },
        },
      })

      await auditLog(fastify.prisma, {
        action: 'FEATURE_REQUEST_STATUS_UPDATE',
        actorId: actor.id,
        targetId: id,
        meta: { status: updated.status },
      })

      return reply.send({
        id: updated.id,
        title: updated.title,
        description: updated.description,
        status: updated.status,
        proposer: updated.proposedBy.displayName,
        proposerUsername: updated.proposedBy.username,
        voteCount: updated._count.votes,
        youVoted: false,
        commentCount: updated._count.comments,
        reviewNote: updated.reviewNote,
        reviewedAt: updated.reviewedAt,
        mergedIntoId: updated.mergedIntoId,
        mergedIntoTitle: updated.mergedInto?.title ?? null,
        createdAt: updated.createdAt,
      })
    },
  )

  // GET /api/admin/feature-requests/reports — generated quarterly reports
  fastify.get(
    '/api/admin/feature-requests/reports',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(
          FeatureRequestQuarterlyReportListSchema,
          'FeatureRequestQuarterlyReportList',
        ),
      },
    },
    async (_request, reply) => {
      const rows = await fastify.prisma.featureRequestQuarterlyReport.findMany({
        orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
        include: { generatedBy: { select: { displayName: true } } },
      })

      const reports = await Promise.all(
        rows.map(async (r) => ({
          id: r.id.toString(),
          year: r.year,
          quarter: r.quarter,
          storageKey: r.storageKey,
          generatedAt: r.generatedAt,
          generatedByDisplayName: r.generatedBy.displayName,
          downloadUrl: await presignedGetUrl(r.storageKey, 3600).catch(() => null),
        })),
      )

      return reply.send(reports)
    },
  )

  // POST /api/admin/feature-requests/reports — assemble + store this (or a given) quarter's report
  fastify.post(
    '/api/admin/feature-requests/reports',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponses([
          {
            status: 200,
            schema: FeatureRequestQuarterlyReportGeneratedSchema,
            name: 'FeatureRequestQuarterlyReportGenerated',
          },
        ]),
      },
    },
    async (request, reply) => {
      const actor = request.sessionUser!
      const parsed = GenerateFeatureRequestQuarterlyReportSchema.safeParse(request.body ?? {})
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const { year, quarter } = { ...currentQuarter(), ...parsed.data }

      const { markdown } = await assembleFeatureRequestQuarterlyReportMarkdown(
        fastify.prisma,
        year,
        quarter,
      )
      const storageKey = featureRequestQuarterlyReportStorageKey(year, quarter)
      await putObjectText(storageKey, markdown, 'text/markdown; charset=utf-8')

      const row = await fastify.prisma.featureRequestQuarterlyReport.upsert({
        where: { year_quarter: { year, quarter } },
        create: { year, quarter, storageKey, generatedById: actor.id },
        update: { storageKey, generatedAt: new Date(), generatedById: actor.id },
      })

      await auditLog(fastify.prisma, {
        action: 'FEATURE_REQUEST_QUARTERLY_REPORT',
        actorId: actor.id,
        meta: { year, quarter },
      })

      const downloadUrl = await presignedGetUrl(storageKey, 3600)

      return reply.send({
        ok: true as const,
        year,
        quarter,
        id: row.id.toString(),
        markdown,
        downloadUrl,
      })
    },
  )
}

export default adminFeatureRequestRoutes
