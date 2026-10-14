// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AdminAnnualReportGeneratedSchema,
  AdminAnnualReportListSchema,
  AdminAnnualReportRowSchema,
  ApproveAnnualReportSchema,
  openApiResponse,
  openApiResponses,
  yearFromPathParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { assembleAnnualReportMarkdown, annualReportStorageKey } from '../../lib/annual-report.js'
import { presignedGetUrl, putObjectText } from '../../lib/minio.js'
import { auditLog } from '../../lib/audit.js'

function reportRow(report: {
  id: bigint
  year: number
  storageKey: string
  generatedAt: Date
  generatedBy: { displayName: string }
  approvedAt: Date | null
  approvalMeetingId: string | null
}) {
  return presignedGetUrl(report.storageKey, 3600)
    .catch(() => null)
    .then((downloadUrl) => ({
      id: report.id.toString(),
      year: report.year,
      storageKey: report.storageKey,
      generatedAt: report.generatedAt,
      generatedByDisplayName: report.generatedBy.displayName,
      downloadUrl,
      approvedAt: report.approvedAt,
      approvalMeetingId: report.approvalMeetingId,
    }))
}

const adminReportsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/reports',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'M21-G: list generated annual transparency reports',
        response: openApiResponse(AdminAnnualReportListSchema, 'AdminAnnualReportList'),
      },
    },
    async (_request, reply) => {
      const rows = await fastify.prisma.annualReport.findMany({
        orderBy: { year: 'desc' },
        include: { generatedBy: { select: { displayName: true } } },
      })

      return reply.send(await Promise.all(rows.map(reportRow)))
    },
  )

  fastify.post(
    '/api/admin/reports/annual/:year',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'M21-G: assemble annual report Markdown and store in MinIO',
        response: openApiResponses([
          {
            status: 200,
            schema: AdminAnnualReportGeneratedSchema,
            name: 'AdminAnnualReportGenerated',
          },
        ]),
      },
    },
    async (request, reply) => {
      const actor = request.sessionUser!
      const year = yearFromPathParams(request.params)
      if (year === null) return reply.status(400).send({ error: 'Invalid year' })

      const existing = await fastify.prisma.annualReport.findUnique({
        where: { year },
        select: { approvedAt: true },
      })
      if (existing?.approvedAt) {
        return reply
          .status(409)
          .send({ error: 'This report has been approved and is not regenerated in place' })
      }

      const { markdown } = await assembleAnnualReportMarkdown(fastify.prisma, year)
      const storageKey = annualReportStorageKey(year)

      await putObjectText(storageKey, markdown, 'text/markdown; charset=utf-8')

      const row = await fastify.prisma.annualReport.upsert({
        where: { year },
        create: {
          year,
          storageKey,
          generatedById: actor.id,
        },
        update: {
          storageKey,
          generatedAt: new Date(),
          generatedById: actor.id,
        },
      })

      await auditLog(fastify.prisma, {
        action: 'ANNUAL_REPORT_GENERATE',
        actorId: actor.id,
        targetId: String(year),
        meta: { year, storageKey },
      })

      const downloadUrl = await presignedGetUrl(storageKey, 3600)

      return reply.send({
        ok: true as const,
        year,
        id: row.id.toString(),
        markdown,
        downloadUrl,
      })
    },
  )

  // The board approves the report as generated, optionally naming the meeting
  // that did so. Generated reports had no state at all: nothing told a draft
  // from the report the association stands behind.
  fastify.post(
    '/api/admin/reports/annual/:year/approve',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminAnnualReportRowSchema, 'AdminAnnualReportRow'),
      },
    },
    async (request, reply) => {
      const year = yearFromPathParams(request.params)
      if (year === null) return reply.status(400).send({ error: 'Invalid year' })
      const parsed = ApproveAnnualReportSchema.safeParse(request.body ?? {})
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      const { meetingId } = parsed.data

      const report = await fastify.prisma.annualReport.findUnique({ where: { year } })
      if (!report)
        return reply.status(404).send({ error: 'No report has been generated for that year' })
      if (report.approvedAt)
        return reply.status(409).send({ error: 'This report is already approved' })
      if (meetingId) {
        const meeting = await fastify.prisma.governanceMeeting.findUnique({
          where: { id: meetingId },
          select: { id: true },
        })
        if (!meeting) return reply.status(400).send({ error: 'Meeting not found' })
      }

      const updated = await fastify.prisma.annualReport.update({
        where: { year },
        data: {
          approvedAt: new Date(),
          approvedById: request.sessionUser!.id,
          approvalMeetingId: meetingId ?? null,
        },
        include: { generatedBy: { select: { displayName: true } } },
      })
      await auditLog(fastify.prisma, {
        action: 'ANNUAL_REPORT_APPROVE',
        actorId: request.sessionUser!.id,
        targetId: String(year),
        meta: { year, storageKey: updated.storageKey, meetingId: meetingId ?? null },
      })
      return reply.send(await reportRow(updated))
    },
  )
}

export default adminReportsRoutes
