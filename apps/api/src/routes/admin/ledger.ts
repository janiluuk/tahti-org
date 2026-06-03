// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireBoard } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'

// Treasurer-only: manually create ledger entries (infrastructure bills,
// salaries, donations, grants received, etc.). Gated to board members
// (requireBoard) now that M10 introduced the board role — manual ledger
// mutations must not be open to every member.

const adminLedgerRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/admin/ledger — create a manual ledger entry
  fastify.post('/api/admin/ledger', { preHandler: requireBoard }, async (request, reply) => {
    const user = request.sessionUser!
    const body = request.body as {
      category?: string
      amountCents?: number
      currency?: string
      description?: string
      externalRef?: string
      periodStart?: string
      periodEnd?: string
    }

    const validCategories = [
      'REVENUE_SUBSCRIPTION',
      'REVENUE_DISTRIBUTION',
      'REVENUE_GRANT_INBOUND',
      'REVENUE_DONATION',
      'COST_INFRASTRUCTURE',
      'COST_DISTRIBUTION_PASSTHROUGH',
      'COST_OPERATIONS',
      'COST_SALARY',
      'COST_AUDIT',
      'COST_PROFESSIONAL_SERVICES',
      'GRANT_DISBURSEMENT',
      'RESERVE_TRANSFER',
    ]

    if (!body.category || !validCategories.includes(body.category)) {
      return reply.status(400).send({ error: 'Valid category is required' })
    }
    if (!body.amountCents || typeof body.amountCents !== 'number' || body.amountCents <= 0) {
      return reply.status(400).send({ error: 'amountCents must be a positive number' })
    }
    if (!body.description?.trim()) {
      return reply.status(400).send({ error: 'description is required' })
    }
    if (!body.periodStart || !body.periodEnd) {
      return reply.status(400).send({ error: 'periodStart and periodEnd are required' })
    }

    const entry = await fastify.prisma.ledgerEntry.create({
      data: {
        category: body.category as 'REVENUE_SUBSCRIPTION',
        amountCents: BigInt(Math.round(body.amountCents)),
        currency: body.currency ?? 'EUR',
        description: body.description.trim(),
        externalRef: body.externalRef?.trim() ?? null,
        periodStart: new Date(body.periodStart),
        periodEnd: new Date(body.periodEnd),
        createdBy: user.id,
      },
    })

    await auditLog(fastify.prisma, {
      action: 'LEDGER_ENTRY_CREATE',
      actorId: user.id,
      targetId: entry.id.toString(),
      meta: { category: body.category, amountCents: body.amountCents },
    })

    return reply.status(201).send({
      id: entry.id.toString(),
      category: entry.category,
      amountCents: entry.amountCents.toString(),
    })
  })

  // GET /api/admin/ledger?year=YYYY&month=MM — list entries for period
  fastify.get('/api/admin/ledger', { preHandler: requireBoard }, async (request, reply) => {
    const { year, month } = request.query as { year?: string; month?: string }

    const periodStart = year
      ? new Date(`${year}-${month ?? '01'}-01`)
      : new Date(new Date().getFullYear(), 0, 1)

    const periodEnd =
      year && month
        ? new Date(parseInt(year), parseInt(month), 0) // last day of month
        : new Date(new Date().getFullYear(), 11, 31)

    const entries = await fastify.prisma.ledgerEntry.findMany({
      where: {
        periodStart: { gte: periodStart },
        periodEnd: { lte: periodEnd },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    return reply.send(
      entries.map((e) => ({
        ...e,
        id: e.id.toString(),
        amountCents: e.amountCents.toString(),
      })),
    )
  })
}

export default adminLedgerRoutes
