// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  CreateGovernanceCorrectionSchema,
  GovernanceCorrectionItemSchema,
  GovernanceCorrectionListSchema,
  openApiResponse,
  openApiResponses,
} from '@tahti/shared'
import { requireMember } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'

/** How many unanswered requests one member can have waiting. */
const MAX_OPEN_REQUESTS = 5

type CorrectionRow = {
  id: string
  subject: string
  details: string
  state: string
  resolutionNote: string | null
  resolvedAt: Date | null
  createdAt: Date
}

export function correctionView(row: CorrectionRow) {
  return {
    id: row.id,
    subject: row.subject,
    details: row.details,
    state: row.state,
    resolutionNote: row.resolutionNote,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
  }
}

// Member requests to correct their member-register data or a governance
// record. A member can read the register and the records but had no way to
// say "this is wrong" that left a trace; it went by email, if at all.

const correctionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/v1/governance/corrections',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponses([
          { status: 201, schema: GovernanceCorrectionItemSchema, name: 'GovernanceCorrection' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = CreateGovernanceCorrectionSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const waiting = await fastify.prisma.governanceCorrectionRequest.count({
        where: { requesterId: user.id, state: 'OPEN' },
      })
      if (waiting >= MAX_OPEN_REQUESTS) {
        return reply.status(409).send({
          error: `You already have ${MAX_OPEN_REQUESTS} correction requests waiting for an answer`,
        })
      }

      const row = await fastify.prisma.governanceCorrectionRequest.create({
        data: { requesterId: user.id, subject: parsed.data.subject, details: parsed.data.details },
      })
      // The details can hold personal data, so the audit entry only says
      // that a request was made and about what.
      await auditLog(fastify.prisma, {
        action: 'CORRECTION_REQUEST',
        actorId: user.id,
        targetId: row.id,
        meta: { subject: row.subject },
      })
      return reply.status(201).send(correctionView(row))
    },
  )

  // GET /api/v1/governance/corrections — the member's own requests, newest
  // first, with the board's answer once there is one.
  fastify.get(
    '/api/v1/governance/corrections',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(GovernanceCorrectionListSchema, 'GovernanceCorrectionList'),
      },
    },
    async (request, reply) => {
      const rows = await fastify.prisma.governanceCorrectionRequest.findMany({
        where: { requesterId: request.sessionUser!.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 100,
      })
      return reply.send(rows.map(correctionView))
    },
  )
}

export default correctionRoutes
