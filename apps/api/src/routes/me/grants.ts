// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { MeGrantEstimateSchema, MeGrantListSchema, openApiResponse } from '@tahti/shared'
import { allocateGrants, computeEngagementUnits } from '@tahti/ledger'
import { requireAuth } from '../../plugins/auth.js'

// M9 — an artist's own grant disbursements across years.
const meGrantsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/grants',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['transparency'],
        response: openApiResponse(MeGrantListSchema, 'MeGrantList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!

      const grants = await fastify.prisma.grantDisbursement.findMany({
        where: { userId: user.id },
        orderBy: { forYear: 'desc' },
        select: {
          forYear: true,
          units: true,
          amountCents: true,
          state: true,
          notifiedAt: true,
          confirmedAt: true,
          paidAt: true,
        },
      })

      return reply.send(
        grants.map((g) => ({
          ...g,
          amountCents: g.amountCents.toString(),
        })),
      )
    },
  )

  // M19: forecast this artist's share of the current year's grant pool
  // based on engagement units accrued so far.
  fastify.get(
    '/api/me/grants/estimate',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['transparency'],
        response: openApiResponse(MeGrantEstimateSchema, 'MeGrantEstimate'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const year = new Date().getFullYear()

      const rollups = await fastify.prisma.monthlyRollup.findMany({
        where: { yearMonth: { startsWith: `${year}-` } },
        select: { surplus: true },
      })
      const surplusCents = rollups.reduce((s, r) => s + Number(r.surplus), 0)

      const unitRows = await computeEngagementUnits(fastify.prisma, year)
      const allocation = allocateGrants({ surplusCents, artists: unitRows })

      const mine = unitRows.find((r) => r.userId === user.id)
      const myAllocation = allocation.allocations.find((a) => a.userId === user.id)

      return reply.send({
        year,
        estimateCents: myAllocation?.amountCents ?? 0,
        units: mine?.units ?? 0,
        eligible: (mine?.units ?? 0) >= 5,
      })
    },
  )
}

export default meGrantsRoutes
