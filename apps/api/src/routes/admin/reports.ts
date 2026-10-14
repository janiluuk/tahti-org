// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AdminAnnualReportGeneratedSchema,
  AdminAnnualReportListSchema,
  AdminAnnualReportRowSchema,
  AnnualReportFilingSchema,
  AnnualReportRevisionListSchema,
  ApproveAnnualReportSchema,
  CorrectAnnualReportSchema,
  PublishedAnnualReportListSchema,
  openApiResponse,
  openApiResponses,
  yearFromPathParams,
} from '@tahti/shared'
import { requireBoard, requireMember } from '../../plugins/auth.js'
import {
  assembleAnnualReportMarkdown,
  annualReportStorageKey,
  correctedAnnualReportStorageKey,
} from '../../lib/annual-report.js'
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
  publishedAt: Date | null
  filedAt: Date | null
  filingReference: string | null
  correctedAt: Date | null
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
      publishedAt: report.publishedAt,
      filedAt: report.filedAt,
      filingReference: report.filingReference,
      correctedAt: report.correctedAt,
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

  fastify.post(
    '/api/admin/reports/annual/:year/publish',
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
      const report = await fastify.prisma.annualReport.findUnique({ where: { year } })
      if (!report)
        return reply.status(404).send({ error: 'No report has been generated for that year' })
      if (!report.approvedAt) {
        return reply.status(409).send({ error: 'Only an approved report can be published' })
      }
      if (report.publishedAt)
        return reply.status(409).send({ error: 'This report is already published' })

      const updated = await fastify.prisma.annualReport.update({
        where: { year },
        data: { publishedAt: new Date() },
        include: { generatedBy: { select: { displayName: true } } },
      })
      await auditLog(fastify.prisma, {
        action: 'ANNUAL_REPORT_PUBLISH',
        actorId: request.sessionUser!.id,
        targetId: String(year),
        meta: { year, storageKey: updated.storageKey },
      })
      return reply.send(await reportRow(updated))
    },
  )

  // Filing status: when the approved report went to the authority that
  // receives it, and the reference given. Nothing recorded this before.
  fastify.put(
    '/api/admin/reports/annual/:year/filing',
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
      const parsed = AnnualReportFilingSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      const report = await fastify.prisma.annualReport.findUnique({ where: { year } })
      if (!report)
        return reply.status(404).send({ error: 'No report has been generated for that year' })
      if (!report.approvedAt) {
        return reply.status(409).send({ error: 'Only an approved report can be filed' })
      }
      const { filedAt } = parsed.data
      const filingReference = filedAt ? (parsed.data.filingReference ?? null) : null
      if (filedAt && filedAt < report.approvedAt) {
        return reply.status(400).send({ error: 'A report cannot be filed before it was approved' })
      }

      const updated = await fastify.prisma.annualReport.update({
        where: { year },
        data: { filedAt, filingReference },
        include: { generatedBy: { select: { displayName: true } } },
      })
      if (
        report.filedAt?.getTime() !== filedAt?.getTime() ||
        report.filingReference !== filingReference
      ) {
        await auditLog(fastify.prisma, {
          action: 'ANNUAL_REPORT_FILE',
          actorId: request.sessionUser!.id,
          targetId: String(year),
          meta: { year, filedAt, filingReference },
        })
      }
      return reply.send(await reportRow(updated))
    },
  )

  // An approved report is not regenerated in place. When it turns out to be
  // wrong, the board corrects it: the report is regenerated under a new file,
  // and the version it replaces is kept with the board's note. Approval,
  // publication and filing stay as they were.
  fastify.post(
    '/api/admin/reports/annual/:year/correct',
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
      const parsed = CorrectAnnualReportSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      const report = await fastify.prisma.annualReport.findUnique({ where: { year } })
      if (!report)
        return reply.status(404).send({ error: 'No report has been generated for that year' })
      if (!report.approvedAt) {
        return reply
          .status(409)
          .send({ error: 'A report that is not approved yet is regenerated, not corrected' })
      }

      const now = new Date()
      const { markdown } = await assembleAnnualReportMarkdown(fastify.prisma, year)
      const storageKey = correctedAnnualReportStorageKey(year, now)
      await putObjectText(storageKey, markdown, 'text/markdown; charset=utf-8')

      const [, updated] = await fastify.prisma.$transaction([
        fastify.prisma.annualReportRevision.create({
          data: {
            year,
            storageKey: report.storageKey,
            generatedAt: report.generatedAt,
            replacedAt: now,
            replacedById: request.sessionUser!.id,
            note: parsed.data.note,
          },
        }),
        fastify.prisma.annualReport.update({
          where: { year },
          data: {
            storageKey,
            generatedAt: now,
            generatedById: request.sessionUser!.id,
            correctedAt: now,
          },
          include: { generatedBy: { select: { displayName: true } } },
        }),
      ])
      await auditLog(fastify.prisma, {
        action: 'ANNUAL_REPORT_CORRECT',
        actorId: request.sessionUser!.id,
        targetId: String(year),
        meta: { year, storageKey, replacedStorageKey: report.storageKey },
      })
      return reply.send(await reportRow(updated))
    },
  )

  fastify.get(
    '/api/admin/reports/annual/:year/revisions',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AnnualReportRevisionListSchema, 'AnnualReportRevisionList'),
      },
    },
    async (request, reply) => {
      const year = yearFromPathParams(request.params)
      if (year === null) return reply.status(400).send({ error: 'Invalid year' })
      const revisions = await fastify.prisma.annualReportRevision.findMany({
        where: { year },
        orderBy: [{ replacedAt: 'desc' }, { id: 'desc' }],
      })
      return reply.send(
        await Promise.all(
          revisions.map(async (revision) => ({
            id: revision.id.toString(),
            generatedAt: revision.generatedAt,
            replacedAt: revision.replacedAt,
            note: revision.note,
            downloadUrl: await presignedGetUrl(revision.storageKey, 3600).catch(() => null),
          })),
        ),
      )
    },
  )

  // Members had no way to read a yearly report: generated reports were
  // listed to the board only.
  fastify.get(
    '/api/v1/governance/annual-reports',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(PublishedAnnualReportListSchema, 'PublishedAnnualReportList'),
      },
    },
    async (_request, reply) => {
      const reports = await fastify.prisma.annualReport.findMany({
        where: { publishedAt: { not: null }, approvedAt: { not: null } },
        orderBy: { year: 'desc' },
        select: {
          year: true,
          approvedAt: true,
          publishedAt: true,
          filedAt: true,
          correctedAt: true,
          storageKey: true,
        },
      })
      return reply.send(
        await Promise.all(
          reports.map(async ({ storageKey, ...report }) => ({
            ...report,
            downloadUrl: await presignedGetUrl(storageKey, 3600).catch(() => null),
          })),
        ),
      )
    },
  )
}

export default adminReportsRoutes
