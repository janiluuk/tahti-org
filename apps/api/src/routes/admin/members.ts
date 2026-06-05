// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { CsvExportBodySchema, openApiResponse } from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { sendCsv } from '../../lib/csv.js'

// PRH-compliant member register export (CSV).
const adminMembersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/members/export.csv',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(CsvExportBodySchema, 'CsvExportBody'),
      },
    },
    async (_request, reply) => {
      const members = await fastify.prisma.user.findMany({
        where: { isMember: true },
        orderBy: [{ memberNumber: 'asc' }],
        select: {
          memberNumber: true,
          displayName: true,
          email: true,
          username: true,
          memberSince: true,
          membership: { select: { activatedAt: true, status: true } },
        },
      })

      return sendCsv(
        reply,
        'tahti-members.csv',
        ['memberNumber', 'displayName', 'email', 'username', 'memberSince', 'membershipStatus'],
        members.map((m) => [
          m.memberNumber ?? '',
          m.displayName,
          m.email,
          m.username,
          m.memberSince?.toISOString() ?? '',
          m.membership?.status ?? '',
        ]),
      )
    },
  )
}

export default adminMembersRoutes
