// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  CreateGovernanceElectionSchema,
  GovernanceElectionListSchema,
  openApiResponse,
  openApiResponses,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'

// Board elections. A term could name the meeting that elected it, but
// nothing recorded the election itself: the role, the seats, and who stood.
// Ballots stay at the meeting; the board records the result here.

const ELECTION_SELECT = {
  id: true,
  title: true,
  role: true,
  seats: true,
  meetingId: true,
  nominationsCloseAt: true,
  decidedAt: true,
  createdAt: true,
} as const

const electionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/governance/elections',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(GovernanceElectionListSchema, 'GovernanceElectionList'),
      },
    },
    async (_request, reply) =>
      reply.send(
        await fastify.prisma.governanceElection.findMany({
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: ELECTION_SELECT,
        }),
      ),
  )

  fastify.post(
    '/api/admin/governance/elections',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponses([
          { status: 201, schema: GovernanceElectionListSchema.element, name: 'GovernanceElection' },
        ]),
      },
    },
    async (request, reply) => {
      const parsed = CreateGovernanceElectionSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      const { meetingId } = parsed.data
      if (meetingId) {
        const meeting = await fastify.prisma.governanceMeeting.findUnique({
          where: { id: meetingId },
          select: { id: true },
        })
        if (!meeting) return reply.status(400).send({ error: 'Meeting not found' })
      }
      const election = await fastify.prisma.governanceElection.create({
        data: { ...parsed.data, createdById: request.sessionUser!.id },
        select: ELECTION_SELECT,
      })
      await auditLog(fastify.prisma, {
        action: 'ELECTION_CREATE',
        actorId: request.sessionUser!.id,
        targetId: election.id,
        meta: {
          title: election.title,
          role: election.role,
          seats: election.seats,
          meetingId: election.meetingId,
        },
      })
      return reply.status(201).send(election)
    },
  )
}

export default electionRoutes
