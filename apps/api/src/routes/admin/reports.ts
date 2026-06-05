// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AdminAnnualReportGeneratedSchema,
  AdminAnnualReportListSchema,
  openApiResponse,
  openApiResponses,
  yearFromPathParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { assembleAnnualReportMarkdown, annualReportStorageKey } from '../../lib/annual-report.js'
import { presignedGetUrl, putObjectText } from '../../lib/minio.js'

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

      const reports = await Promise.all(
        rows.map(async (r) => ({
          id: r.id.toString(),
          year: r.year,
          storageKey: r.storageKey,
          generatedAt: r.generatedAt,
          generatedByDisplayName: r.generatedBy.displayName,
          downloadUrl: await presignedGetUrl(r.storageKey, 3600).catch(() => null),
        })),
      )

      return reply.send(reports)
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
}

export default adminReportsRoutes
