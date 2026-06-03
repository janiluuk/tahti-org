// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireBoard } from '../../plugins/auth.js'
import { csvRow } from '../../lib/csv.js'

// PRH-compliant member register export (CSV).
const adminMembersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/members/export.csv',
    { preHandler: requireBoard },
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

      const header = csvRow([
        'memberNumber',
        'displayName',
        'email',
        'username',
        'memberSince',
        'membershipStatus',
      ])
      const rows = members.map((m) =>
        csvRow([
          m.memberNumber ?? '',
          m.displayName,
          m.email,
          m.username,
          m.memberSince?.toISOString() ?? '',
          m.membership?.status ?? '',
        ]),
      )

      const csv = [header, ...rows].join('\n')
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="tahti-members.csv"')
        .send(csv)
    },
  )
}

export default adminMembersRoutes
