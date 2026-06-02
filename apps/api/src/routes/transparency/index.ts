// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

import type { FastifyPluginAsync } from 'fastify'

// Public, CORS-open transparency endpoints.
// These expose the nonprofit's financial data per AGPL principle 6.
const transparencyRoutes: FastifyPluginAsync = async (fastify) => {
  // CORS — allow any origin to read transparency data
  fastify.addHook('onSend', async (request, reply) => {
    if (request.url.startsWith('/api/v1/transparency')) {
      reply.header('Access-Control-Allow-Origin', '*')
    }
  })

  // GET /api/v1/transparency/monthly_rollup?year=YYYY
  fastify.get('/api/v1/transparency/monthly_rollup', async (request, reply) => {
    const { year } = request.query as { year?: string }
    const targetYear = year ?? new Date().getFullYear().toString()
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
  })

  // GET /api/v1/transparency/categories — list all ledger categories with descriptions
  fastify.get('/api/v1/transparency/categories', async (_request, reply) => {
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
  })

  // GET /api/v1/transparency/ytd — current year running summary
  fastify.get('/api/v1/transparency/ytd', async (_request, reply) => {
    const year = new Date().getFullYear().toString()

    const rollups = await fastify.prisma.monthlyRollup.findMany({
      where: { yearMonth: { startsWith: `${year}-` } },
      select: { byCategory: true, surplus: true },
    })

    // Aggregate across all months
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
      byCategory: Object.fromEntries(
        Object.entries(totals).map(([k, v]) => [k, v.toString()]),
      ),
      runningsurplus: totalSurplus.toString(),
      monthsFinalized: rollups.length,
    })
  })
}

export default transparencyRoutes
