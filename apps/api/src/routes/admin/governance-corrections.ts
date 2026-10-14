// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AdminGovernanceCorrectionItemSchema,
  AdminGovernanceCorrectionListSchema,
  GovernanceCorrectionStateSchema,
  IdParamSchema,
  ResolveGovernanceCorrectionSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'
import { userName } from '../../lib/safe-names.js'
import { correctionView } from '../governance/corrections.js'

const requesterSelect = {
  select: { username: true, displayName: true, memberNumber: true },
} as const

type Requester = { username: string; displayName: string; memberNumber: number | null }

function adminCorrectionView(row: Parameters<typeof correctionView>[0] & { requester: Requester }) {
  return {
    ...correctionView(row),
    requester: {
      displayName: userName(row.requester),
      username: row.requester.username,
      memberNumber: row.requester.memberNumber,
    },
  }
}

// The board's side of member correction requests: the queue, and the answer.
// Answering changes no register data or record by itself; the board makes
// the correction where it belongs and says here what it did.

const adminGovernanceCorrectionRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/admin/governance/corrections?state=OPEN — oldest first, so the
  // request that has waited longest is on top.
  fastify.get(
    '/api/admin/governance/corrections',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(
          AdminGovernanceCorrectionListSchema,
          'AdminGovernanceCorrectionList',
        ),
      },
    },
    async (request, reply) => {
      const raw = (request.query as { state?: unknown } | undefined)?.state
      const state = raw === undefined ? undefined : GovernanceCorrectionStateSchema.safeParse(raw)
      if (state && !state.success) return reply.status(400).send({ error: 'Invalid state filter' })

      const rows = await fastify.prisma.governanceCorrectionRequest.findMany({
        where: state ? { state: state.data } : {},
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 200,
        include: { requester: requesterSelect },
      })
      return reply.send(rows.map(adminCorrectionView))
    },
  )

  fastify.patch(
    '/api/admin/governance/corrections/:id',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminGovernanceCorrectionItemSchema, 'AdminGovernanceCorrection'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const parsed = ResolveGovernanceCorrectionSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const existing = await fastify.prisma.governanceCorrectionRequest.findUnique({
        where: { id },
        select: { state: true, requesterId: true },
      })
      if (!existing) return reply.status(404).send({ error: 'Correction request not found' })
      if (existing.requesterId === user.id) {
        return reply
          .status(403)
          .send({ error: 'Another board member has to answer your own request' })
      }

      // The state is part of the update, so two board members answering at
      // once cannot both win.
      const changed = await fastify.prisma.governanceCorrectionRequest.updateMany({
        where: { id, state: 'OPEN' },
        data: {
          state: parsed.data.state,
          resolutionNote: parsed.data.resolutionNote,
          resolvedById: user.id,
          resolvedAt: new Date(),
        },
      })
      if (changed.count === 0) {
        return reply.status(409).send({ error: 'This request has already been answered' })
      }
      await auditLog(fastify.prisma, {
        action: 'CORRECTION_RESOLVE',
        actorId: user.id,
        targetId: id,
        meta: { state: parsed.data.state },
      })

      // The answer was only visible to a member who came back to look. The
      // note itself stays on the request; the notification just points at it.
      await fastify.prisma.notification
        .create({
          data: {
            userId: existing.requesterId,
            type: 'CORRECTION_RESOLVED',
            actorUserId: user.id,
            title:
              parsed.data.state === 'ACCEPTED'
                ? 'Your correction request was accepted'
                : 'Your correction request was declined',
            body: 'The board has answered your correction request.',
            url: '/governance/corrections',
          },
        })
        .catch((err: unknown) => {
          request.log.error({ err, correctionId: id }, 'correction-resolved notification failed')
        })

      const row = await fastify.prisma.governanceCorrectionRequest.findUniqueOrThrow({
        where: { id },
        include: { requester: requesterSelect },
      })
      return reply.send(adminCorrectionView(row))
    },
  )
}

export default adminGovernanceCorrectionRoutes
