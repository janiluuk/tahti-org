// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { PrismaClient } from '@tahti/db'
import {
  CancelGovernanceElectionSchema,
  CreateGovernanceElectionSchema,
  GovernanceElectionCandidateListSchema,
  GovernanceElectionListSchema,
  GovernanceElectionResultSchema,
  IdParamSchema,
  MemberGovernanceElectionListSchema,
  NominateElectionCandidateSchema,
  RecordElectionResultSchema,
  StandForElectionSchema,
  UpdateGovernanceElectionSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard, requireMember } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'
import { boardTermClash } from '../../lib/board-terms.js'

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
  cancelledAt: true,
  cancelReason: true,
  createdAt: true,
} as const

const CANDIDATE_SELECT = {
  id: true,
  userId: true,
  displayName: true,
  statement: true,
  nominatedById: true,
  withdrawnAt: true,
  elected: true,
  createdAt: true,
} as const

const TERM_SELECT = {
  id: true,
  userId: true,
  displayName: true,
  role: true,
  termStart: true,
  termEnd: true,
  endReason: true,
  meetingId: true,
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
  elected: boolean
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

/** Why an election no longer takes changes, if it does not. */
function closedError(election: { decidedAt: Date | null; cancelledAt: Date | null }) {
  if (election.decidedAt) return 'The result of this election is recorded'
  if (election.cancelledAt) return 'This election was cancelled'
  return null
}

const same = (a: unknown, b: unknown) =>
  (a instanceof Date ? a.getTime() : a) === (b instanceof Date ? b.getTime() : b)

/** A result the board cannot record; thrown to roll the whole result back. */
class ResultRefused extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message)
  }
}

const electionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/governance/elections',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(
          MemberGovernanceElectionListSchema,
          'MemberGovernanceElectionList',
        ),
      },
    },
    async (request, reply) => {
      const userId = request.sessionUser!.id
      const now = new Date()
      const elections = await fastify.prisma.governanceElection.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          ...ELECTION_SELECT,
          candidates: {
            where: { withdrawnAt: null },
            orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
            select: {
              userId: true,
              displayName: true,
              statement: true,
              elected: true,
              user: { select: { username: true } },
            },
          },
        },
      })
      return reply.send(
        elections.map(({ candidates, ...election }) => ({
          ...election,
          nominationsOpen:
            !election.decidedAt &&
            !election.cancelledAt &&
            (!election.nominationsCloseAt || election.nominationsCloseAt > now),
          candidates: candidates.map(({ user, userId: _userId, ...candidate }) => ({
            ...candidate,
            username: user?.username ?? null,
          })),
          youAreCandidate: candidates.some((candidate) => candidate.userId === userId),
        })),
      )
    },
  )

  async function findElection(id: string) {
    return fastify.prisma.governanceElection.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        decidedAt: true,
        cancelledAt: true,
        nominationsCloseAt: true,
      },
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

  fastify.patch(
    '/api/admin/governance/elections/:id',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(GovernanceElectionListSchema.element, 'GovernanceElection'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = UpdateGovernanceElectionSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      const existing = await fastify.prisma.governanceElection.findUnique({
        where: { id: routeParams.id },
        select: ELECTION_SELECT,
      })
      if (!existing) return reply.status(404).send({ error: 'Election not found' })
      const closed = closedError(existing)
      if (closed) return reply.status(409).send({ error: closed })
      const { seats, meetingId } = parsed.data
      if (seats !== undefined && existing.role === 'CHAIR' && seats !== 1) {
        return reply.status(400).send({ error: 'There is one chair' })
      }
      if (meetingId) {
        const meeting = await fastify.prisma.governanceMeeting.findUnique({
          where: { id: meetingId },
          select: { id: true },
        })
        if (!meeting) return reply.status(400).send({ error: 'Meeting not found' })
      }
      const changed = (Object.keys(parsed.data) as Array<keyof typeof parsed.data>).filter(
        (key) => parsed.data[key] !== undefined && !same(parsed.data[key], existing[key]),
      )
      if (changed.length === 0) return reply.send(existing)
      // The result cannot be recorded (or the election called off) in between.
      const updated = await fastify.prisma.governanceElection.updateMany({
        where: { id: existing.id, decidedAt: null, cancelledAt: null },
        data: parsed.data,
      })
      if (updated.count === 0) {
        return reply.status(409).send({ error: 'The result of this election is recorded' })
      }
      await auditLog(fastify.prisma, {
        action: 'ELECTION_UPDATE',
        actorId: request.sessionUser!.id,
        targetId: existing.id,
        meta: { title: existing.title, changed },
      })
      return reply.send(
        await fastify.prisma.governanceElection.findUniqueOrThrow({
          where: { id: existing.id },
          select: ELECTION_SELECT,
        }),
      )
    },
  )

  // Calling an election off (the role was dropped from the agenda, or it is
  // run again from scratch). The candidacies stay as they were.
  fastify.post(
    '/api/admin/governance/elections/:id/cancel',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(GovernanceElectionListSchema.element, 'GovernanceElection'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = CancelGovernanceElectionSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      const election = await findElection(routeParams.id)
      if (!election) return reply.status(404).send({ error: 'Election not found' })
      const cancelled = await fastify.prisma.governanceElection.updateMany({
        where: { id: election.id, decidedAt: null, cancelledAt: null },
        data: { cancelledAt: new Date(), cancelReason: parsed.data.reason },
      })
      if (cancelled.count === 0) {
        return reply.status(409).send({ error: closedError(election) ?? 'Election is closed' })
      }
      await auditLog(fastify.prisma, {
        action: 'ELECTION_CANCEL',
        actorId: request.sessionUser!.id,
        targetId: election.id,
        meta: { title: election.title, reason: parsed.data.reason },
      })
      return reply.send(
        await fastify.prisma.governanceElection.findUniqueOrThrow({
          where: { id: election.id },
          select: ELECTION_SELECT,
        }),
      )
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
      const closed = closedError(election)
      if (closed) return reply.status(409).send({ error: closed })
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
        election.cancelledAt ||
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
      const closed = closedError(election)
      if (closed) return reply.status(409).send({ error: closed })
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

  // Recording the result closes the election and gives each elected
  // candidate a board term in its role, named after the electing meeting.
  // Board access (`User.isBoard`) is still granted separately.
  fastify.post(
    '/api/admin/governance/elections/:id/result',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(GovernanceElectionResultSchema, 'GovernanceElectionResult'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = RecordElectionResultSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      const { electedUserIds, termStart, termEnd } = parsed.data
      const actorId = request.sessionUser!.id

      let created: Array<{ id: string; displayName: string; userId: string | null }>
      try {
        created = await fastify.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM "governance"."GovernanceElection" WHERE id = ${routeParams.id} FOR UPDATE`
          const election = await tx.governanceElection.findUnique({
            where: { id: routeParams.id },
            select: {
              id: true,
              role: true,
              seats: true,
              meetingId: true,
              decidedAt: true,
              cancelledAt: true,
            },
          })
          if (!election) throw new ResultRefused(404, 'Election not found')
          const closed = closedError(election)
          if (closed) throw new ResultRefused(409, closed)
          if (electedUserIds.length > election.seats) {
            throw new ResultRefused(400, `This election fills ${election.seats} seat(s)`)
          }
          const candidates = await tx.governanceElectionCandidate.findMany({
            where: { electionId: election.id, userId: { in: electedUserIds }, withdrawnAt: null },
            select: { id: true, userId: true, displayName: true },
          })
          if (candidates.length !== electedUserIds.length) {
            throw new ResultRefused(400, 'Everyone elected must be a standing candidate')
          }
          const terms = []
          for (const candidate of candidates) {
            const clash = await boardTermClash(tx, {
              userId: candidate.userId!,
              role: election.role,
              termStart,
              termEnd: termEnd ?? null,
            })
            if (clash) throw new ResultRefused(409, `${candidate.displayName}: ${clash}`)
            terms.push(
              await tx.governanceBoardTerm.create({
                data: {
                  userId: candidate.userId,
                  displayName: candidate.displayName,
                  role: election.role,
                  termStart,
                  termEnd,
                  meetingId: election.meetingId,
                  createdById: actorId,
                },
                select: { id: true, displayName: true, userId: true },
              }),
            )
          }
          await tx.governanceElectionCandidate.updateMany({
            where: { id: { in: candidates.map((c) => c.id) } },
            data: { elected: true },
          })
          await tx.governanceElection.update({
            where: { id: election.id },
            data: { decidedAt: new Date() },
          })
          return terms
        })
      } catch (err) {
        if (err instanceof ResultRefused)
          return reply.status(err.status).send({ error: err.message })
        throw err
      }

      const election = await fastify.prisma.governanceElection.findUniqueOrThrow({
        where: { id: routeParams.id },
        select: {
          ...ELECTION_SELECT,
          candidates: {
            orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
            select: CANDIDATE_SELECT,
          },
        },
      })
      await auditLog(fastify.prisma, {
        action: 'ELECTION_DECIDE',
        actorId,
        targetId: election.id,
        meta: {
          title: election.title,
          role: election.role,
          elected: created.map((term) => term.displayName),
        },
      })
      for (const term of created) {
        await auditLog(fastify.prisma, {
          action: 'BOARD_TERM_RECORD',
          actorId,
          targetId: term.id,
          meta: {
            userId: term.userId,
            displayName: term.displayName,
            role: election.role,
            termStart,
            termEnd: termEnd ?? null,
            electionId: election.id,
          },
        })
      }
      const { candidates, ...rest } = election
      return reply.send({
        election: rest,
        candidates: candidates.map(candidateRow),
        terms: await fastify.prisma.governanceBoardTerm.findMany({
          where: { id: { in: created.map((term) => term.id) } },
          orderBy: { displayName: 'asc' },
          select: TERM_SELECT,
        }),
      })
    },
  )
}

export default electionRoutes
