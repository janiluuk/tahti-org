// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  GovernanceLegalHoldListSchema,
  GovernanceLegalHoldQuerySchema,
  openApiResponse,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'

// One place to see what is under a legal hold. Holds live on each record
// type, so without this the board had to check every list to know what it
// was still keeping frozen.

const governanceLegalHoldRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/governance/legal-holds',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(GovernanceLegalHoldListSchema, 'GovernanceLegalHoldList'),
      },
    },
    async (request, reply) => {
      const query = GovernanceLegalHoldQuerySchema.safeParse(request.query ?? {})
      if (!query.success) return reply.status(400).send({ error: 'Invalid kind filter' })
      const wanted = new Set(
        query.data.kind ?? ['MEETING', 'DOCUMENT', 'RESOLUTION', 'ANNUAL_REPORT'],
      )
      const held = { legalHoldAt: { not: null } } as const
      const hold = { legalHoldAt: true, legalHoldReason: true } as const
      const [meetings, documents, resolutions, reports] = await Promise.all([
        wanted.has('MEETING')
          ? fastify.prisma.governanceMeeting.findMany({
              where: held,
              select: { id: true, title: true, ...hold },
            })
          : [],
        wanted.has('DOCUMENT')
          ? fastify.prisma.governanceDocument.findMany({
              where: held,
              select: { id: true, title: true, version: true, ...hold },
            })
          : [],
        wanted.has('RESOLUTION')
          ? fastify.prisma.boardResolution.findMany({
              where: held,
              select: { id: true, title: true, ...hold },
            })
          : [],
        wanted.has('ANNUAL_REPORT')
          ? fastify.prisma.annualReport.findMany({ where: held, select: { year: true, ...hold } })
          : [],
      ])
      const rows = [
        ...meetings.map((m) => ({ kind: 'MEETING' as const, ...m })),
        ...documents.map(({ version, ...d }) => ({
          kind: 'DOCUMENT' as const,
          ...d,
          title: `${d.title} (v${version})`,
        })),
        ...resolutions.map((r) => ({ kind: 'RESOLUTION' as const, ...r, id: r.id.toString() })),
        ...reports.map(({ year, ...r }) => ({
          kind: 'ANNUAL_REPORT' as const,
          ...r,
          id: String(year),
          title: `Annual report ${year}`,
        })),
      ]
      return reply.send(rows.sort((a, b) => b.legalHoldAt!.getTime() - a.legalHoldAt!.getTime()))
    },
  )
}

export default governanceLegalHoldRoutes
