// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { AdminGovernanceOverviewSchema, openApiResponse } from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'

/** Board governance dashboard counters, read by Tahti Player's
 * /admin/governance Overview tab. */
const adminGovernanceOverviewRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/governance/overview',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description:
          'Open motions, unverified venues, latest annual report year and resolutions this year',
        response: openApiResponse(AdminGovernanceOverviewSchema, 'AdminGovernanceOverview'),
      },
    },
    async (_request, reply) => {
      const startOfYear = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1))
      const [openMotions, pendingVenueVerifications, lastReport, boardResolutionsThisYear] =
        await Promise.all([
          fastify.prisma.motion.count({ where: { state: 'OPEN' } }),
          fastify.prisma.venue.count({ where: { verifiedAt: null } }),
          fastify.prisma.annualReport.findFirst({
            orderBy: { year: 'desc' },
            select: { year: true },
          }),
          fastify.prisma.boardResolution.count({ where: { votedAt: { gte: startOfYear } } }),
        ])
      return reply.send({
        openMotions,
        pendingVenueVerifications,
        lastAnnualReportYear: lastReport?.year ?? null,
        boardResolutionsThisYear,
      })
    },
  )
}

export default adminGovernanceOverviewRoutes
