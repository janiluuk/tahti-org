// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  CreateLedgerEntrySchema,
  CsvExportBodySchema,
  LedgerEntryCreatedSchema,
  LedgerEntryListSchema,
  LedgerExportQuerySchema,
  LedgerListQuerySchema,
  openApiResponse,
  openApiResponses,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'
import { csvRow } from '../../lib/csv.js'

// Treasurer-only: manually create ledger entries (infrastructure bills,
// salaries, donations, grants received, etc.). Gated to board members
// (requireBoard) now that M10 introduced the board role — manual ledger
// mutations must not be open to every member.

const adminLedgerRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/admin/ledger — create a manual ledger entry
  fastify.post(
    '/api/admin/ledger',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponses([
          { status: 201, schema: LedgerEntryCreatedSchema, name: 'LedgerEntryCreated' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = CreateLedgerEntrySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }
      const body = parsed.data

      const entry = await fastify.prisma.ledgerEntry.create({
        data: {
          category: body.category,
          amountCents: BigInt(body.amountCents),
          currency: body.currency ?? 'EUR',
          description: body.description,
          externalRef: body.externalRef ?? null,
          periodStart: body.periodStart,
          periodEnd: body.periodEnd,
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
    },
  )

  // GET /api/admin/ledger?year=YYYY&month=MM — list entries for period
  fastify.get(
    '/api/admin/ledger',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(LedgerEntryListSchema, 'LedgerEntryList'),
      },
    },
    async (request, reply) => {
      const parsed = LedgerListQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid query',
        })
      }
      const { year, month } = parsed.data

      const periodStart = year
        ? new Date(`${year}-${month ?? '01'}-01`)
        : new Date(new Date().getFullYear(), 0, 1)

      const periodEnd =
        year && month
          ? new Date(parseInt(year, 10), parseInt(month, 10), 0)
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
    },
  )

  // GET /api/admin/ledger/export.csv?year=YYYY — auditor-ready ledger export (M11)
  fastify.get(
    '/api/admin/ledger/export.csv',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(CsvExportBodySchema, 'CsvExportBody'),
      },
    },
    async (request, reply) => {
      const parsed = LedgerExportQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid year',
        })
      }
      const y = parsed.data.year ? parseInt(parsed.data.year, 10) : new Date().getFullYear()

      const start = new Date(Date.UTC(y, 0, 1))
      const end = new Date(Date.UTC(y + 1, 0, 1))

      const entries = await fastify.prisma.ledgerEntry.findMany({
        where: { periodStart: { gte: start, lt: end } },
        orderBy: [{ periodStart: 'asc' }, { id: 'asc' }],
      })

      const rollups = await fastify.prisma.monthlyRollup.findMany({
        where: { yearMonth: { startsWith: `${y}-` } },
        orderBy: { yearMonth: 'asc' },
      })

      const lines: string[] = []
      lines.push('# Tahti ry ledger export')
      lines.push(`# Year: ${y}`)
      lines.push('')
      lines.push(csvRow(['section', 'yearMonth', 'category', 'amountCents', 'surplusCents']))
      for (const r of rollups) {
        const by = r.byCategory as Record<string, string>
        for (const [cat, cents] of Object.entries(by)) {
          lines.push(csvRow(['rollup', r.yearMonth, cat, cents, r.surplus.toString()]))
        }
        if (Object.keys(by).length === 0) {
          lines.push(csvRow(['rollup', r.yearMonth, '', '', r.surplus.toString()]))
        }
      }
      lines.push('')
      lines.push(
        csvRow([
          'id',
          'createdAt',
          'category',
          'amountCents',
          'currency',
          'description',
          'externalRef',
          'periodStart',
          'periodEnd',
          'createdBy',
        ]),
      )
      for (const e of entries) {
        lines.push(
          csvRow([
            e.id.toString(),
            e.createdAt.toISOString(),
            e.category,
            e.amountCents.toString(),
            e.currency,
            e.description,
            e.externalRef,
            e.periodStart.toISOString(),
            e.periodEnd.toISOString(),
            e.createdBy,
          ]),
        )
      }

      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="tahti-ledger-${y}.csv"`)
        .send(lines.join('\n'))
    },
  )
}

export default adminLedgerRoutes
