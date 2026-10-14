// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { PrismaClient } from '@tahti/db'
import {
  CreateGovernanceElectionSchema,
  GovernanceElectionCandidateListSchema,
  GovernanceElectionListSchema,
  IdParamSchema,
  NominateElectionCandidateSchema,
  StandForElectionSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard, requireMember } from '../../plugins/auth.js'
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

const CANDIDATE_SELECT = {
  id: true,
  userId: true,
  displayName: true,
  statement: true,
  nominatedById: true,
  withdrawnAt: true,
  createdAt: true,
} as const

function candidateRow({
  nominatedById,
  ...candidate
}: {
  id: string
  userId: string | null
  displayName: string
  statement: string | null
  nominatedById: string | null
  withdrawnAt: Date | null
  createdAt: Date
}) {
  return { ...candidate, selfNominated: nominatedById === candidate.userId }
}

/**
 * Adds a member to an election, or brings back a withdrawn candidacy. The
 * name is copied as it is now, like a board term's.
 */
async function nominate(
  prisma: PrismaClient,
  electionId: string,
  user: { id: string; displayName: string },
  statement: string | undefined,
  nominatedById: string,
) {
  return prisma.governanceElectionCandidate.upsert({
    where: { electionId_userId: { electionId, userId: user.id } },
    create: {
      electionId,
      userId: user.id,
      displayName: user.displayName,
      statement,
      nominatedById,
    },
    update: { withdrawnAt: null, statement, nominatedById },
    select: CANDIDATE_SELECT,
  })
}

const electionRoutes: FastifyPluginAsync = async (fastify) => {
  async function findElection(id: string) {
    return fastify.prisma.governanceElection.findUnique({
      where: { id },
      select: { id: true, title: true, decidedAt: true, nominationsCloseAt: true },
    })
  }

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

  fastify.get(
    '/api/admin/governance/elections/:id/candidates',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(
          GovernanceElectionCandidateListSchema,
          'GovernanceElectionCandidateList',
        ),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      if (!(await findElection(routeParams.id))) {
        return reply.status(404).send({ error: 'Election not found' })
      }
      const candidates = await fastify.prisma.governanceElectionCandidate.findMany({
        where: { electionId: routeParams.id },
        orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
        select: CANDIDATE_SELECT,
      })
      return reply.send(candidates.map(candidateRow))
    },
  )

  // The board can nominate until the result is recorded, also after the
  // nomination deadline: a meeting can take nominations from the floor.
  fastify.post(
    '/api/admin/governance/elections/:id/candidates',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponses([
          {
            status: 201,
            schema: GovernanceElectionCandidateListSchema.element,
            name: 'GovernanceElectionCandidate',
          },
        ]),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = NominateElectionCandidateSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      const election = await findElection(routeParams.id)
      if (!election) return reply.status(404).send({ error: 'Election not found' })
      if (election.decidedAt) {
        return reply.status(409).send({ error: 'The result of this election is recorded' })
      }
      const user = await fastify.prisma.user.findUnique({
        where: { id: parsed.data.userId },
        select: { id: true, displayName: true, isMember: true },
      })
      if (!user?.isMember) {
        return reply.status(400).send({ error: 'Candidates are members of the association' })
      }
      const candidate = await nominate(
        fastify.prisma,
        election.id,
        user,
        parsed.data.statement,
        request.sessionUser!.id,
      )
      await auditLog(fastify.prisma, {
        action: 'ELECTION_NOMINATE',
        actorId: request.sessionUser!.id,
        targetId: election.id,
        meta: {
          election: election.title,
          userId: user.id,
          displayName: user.displayName,
          self: false,
        },
      })
      return reply.status(201).send(candidateRow(candidate))
    },
  )

  // A member stands while nominations are open.
  fastify.post(
    '/api/v1/governance/elections/:id/candidacy',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponses([
          {
            status: 201,
            schema: GovernanceElectionCandidateListSchema.element,
            name: 'GovernanceElectionCandidate',
          },
        ]),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = StandForElectionSchema.safeParse(request.body ?? {})
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      const election = await findElection(routeParams.id)
      if (!election) return reply.status(404).send({ error: 'Election not found' })
      if (
        election.decidedAt ||
        (election.nominationsCloseAt && election.nominationsCloseAt <= new Date())
      ) {
        return reply.status(409).send({ error: 'Nominations for this election are closed' })
      }
      const user = await fastify.prisma.user.findUniqueOrThrow({
        where: { id: request.sessionUser!.id },
        select: { id: true, displayName: true },
      })
      const candidate = await nominate(
        fastify.prisma,
        election.id,
        user,
        parsed.data.statement,
        user.id,
      )
      await auditLog(fastify.prisma, {
        action: 'ELECTION_NOMINATE',
        actorId: user.id,
        targetId: election.id,
        meta: {
          election: election.title,
          userId: user.id,
          displayName: user.displayName,
          self: true,
        },
      })
      return reply.status(201).send(candidateRow(candidate))
    },
  )

  // A candidate withdraws, until the result is recorded.
  fastify.delete(
    '/api/v1/governance/elections/:id/candidacy',
    {
      preHandler: requireMember,
      schema: { tags: ['governance'] },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const election = await findElection(routeParams.id)
      if (!election) return reply.status(404).send({ error: 'Election not found' })
      if (election.decidedAt) {
        return reply.status(409).send({ error: 'The result of this election is recorded' })
      }
      const userId = request.sessionUser!.id
      const candidate = await fastify.prisma.governanceElectionCandidate.findUnique({
        where: { electionId_userId: { electionId: election.id, userId } },
        select: { id: true, displayName: true, withdrawnAt: true },
      })
      if (!candidate) return reply.status(404).send({ error: 'You are not a candidate' })
      if (!candidate.withdrawnAt) {
        await fastify.prisma.governanceElectionCandidate.update({
          where: { id: candidate.id },
          data: { withdrawnAt: new Date() },
        })
        await auditLog(fastify.prisma, {
          action: 'ELECTION_WITHDRAW',
          actorId: userId,
          targetId: election.id,
          meta: { election: election.title, userId, displayName: candidate.displayName },
        })
      }
      return reply.status(204).send()
    },
  )
}

export default electionRoutes
