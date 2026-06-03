// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  TransparencyCategoriesResponseSchema,
  TransparencyGrantReportSchema,
  TransparencyMonthlyRollupListSchema,
  TransparencyYearQuerySchema,
  TransparencyYtdResponseSchema,
  openApiResponse,
  yearFromPathParams,
} from '@tahti/shared'

// Public, CORS-open transparency endpoints.
// These expose the nonprofit's financial data per AGPL principle 6.
const transparencyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onSend', async (request, reply) => {
    if (request.url.startsWith('/api/v1/transparency')) {
      reply.header('Access-Control-Allow-Origin', '*')
    }
  })

  fastify.get(
    '/api/v1/transparency/monthly_rollup',
    {
      schema: {
        tags: ['transparency'],
        description: 'Monthly ledger rollups by category for a calendar year',
        response: openApiResponse(
          TransparencyMonthlyRollupListSchema,
          'TransparencyMonthlyRollupList',
        ),
      },
    },
    async (request, reply) => {
      const parsed = TransparencyYearQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid query',
        })
      }
      const targetYear = parsed.data.year ?? new Date().getFullYear().toString()
      const prefix = `${targetYear}-`

      const rollups = await fastify.prisma.monthlyRollup.findMany({
        where: { yearMonth: { startsWith: prefix } },
        orderBy: { yearMonth: 'asc' },
        select: { yearMonth: true, byCategory: true, surplus: true, finalizedAt: true },
      })

      return reply.send(
        rollups.map((r) => ({
          ...r,
          surplus: r.surplus.toString(),
        })),
      )
    },
  )

  fastify.get(
    '/api/v1/transparency/categories',
    {
      schema: {
        tags: ['transparency'],
        description: 'Ledger category codes and human-readable labels',
        response: openApiResponse(TransparencyCategoriesResponseSchema, 'TransparencyCategories'),
      },
    },
    async (_request, reply) => {
      return reply.send({
        revenue: [
          { code: 'REVENUE_SUBSCRIPTION', label: 'Member subscriptions' },
          { code: 'REVENUE_DISTRIBUTION', label: 'Distribution fee revenue' },
          { code: 'REVENUE_GRANT_INBOUND', label: 'Grant income' },
          { code: 'REVENUE_DONATION', label: 'Donations' },
        ],
        costs: [
          { code: 'COST_INFRASTRUCTURE', label: 'Infrastructure & hosting' },
          { code: 'COST_DISTRIBUTION_PASSTHROUGH', label: 'Distribution pass-through costs' },
          { code: 'COST_OPERATIONS', label: 'Operations' },
          { code: 'COST_SALARY', label: 'Salaries' },
          { code: 'COST_AUDIT', label: 'Audit & accounting' },
          { code: 'COST_PROFESSIONAL_SERVICES', label: 'Professional services' },
        ],
        disbursements: [
          { code: 'GRANT_DISBURSEMENT', label: 'Artist grant disbursements' },
          { code: 'RESERVE_TRANSFER', label: 'Reserve fund transfers' },
        ],
      })
    },
  )

  fastify.get(
    '/api/v1/transparency/grants/:year',
    {
      schema: {
        tags: ['transparency'],
        description: 'M9: published artist grant disbursements for a year',
        response: openApiResponse(TransparencyGrantReportSchema, 'TransparencyGrantReport'),
      },
    },
    async (request, reply) => {
      const forYear = yearFromPathParams(request.params)
      if (forYear === null) {
        return reply.status(400).send({ error: 'Invalid year' })
      }

      const grants = await fastify.prisma.grantDisbursement.findMany({
        where: { forYear },
        orderBy: { amountCents: 'desc' },
        select: { publishedAs: true, units: true, amountCents: true, state: true },
      })

      const totalCents = grants.reduce((s, g) => s + g.amountCents, 0n)

      return reply.send({
        year: forYear,
        totalCents: totalCents.toString(),
        grantCount: grants.length,
        grants: grants.map((g) => ({
          publishedAs: g.publishedAs,
          units: g.units,
          amountCents: g.amountCents.toString(),
          state: g.state,
        })),
      })
    },
  )

  fastify.get(
    '/api/v1/transparency/ytd',
    {
      schema: {
        tags: ['transparency'],
        description: 'Year-to-date running surplus and category totals',
        response: openApiResponse(TransparencyYtdResponseSchema, 'TransparencyYtd'),
      },
    },
    async (_request, reply) => {
      const year = new Date().getFullYear().toString()

      const rollups = await fastify.prisma.monthlyRollup.findMany({
        where: { yearMonth: { startsWith: `${year}-` } },
        select: { byCategory: true, surplus: true },
      })

      const totals: Record<string, bigint> = {}
      let totalSurplus = 0n

      for (const r of rollups) {
        totalSurplus += r.surplus
        const cats = r.byCategory as Record<string, number>
        for (const [cat, amt] of Object.entries(cats)) {
          totals[cat] = (totals[cat] ?? 0n) + BigInt(amt)
        }
      }

      return reply.send({
        year,
        byCategory: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v.toString()])),
        runningSurplus: totalSurplus.toString(),
        monthsFinalized: rollups.length,
      })
    },
  )
}

export default transparencyRoutes
