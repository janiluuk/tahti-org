// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  BoardOnDateQuerySchema,
  CreateGovernanceBoardTermSchema,
  CurrentBoardSchema,
  EndGovernanceBoardTermSchema,
  GovernanceBoardTermListSchema,
  IdParamSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard, requireMember } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'
import { boardTermClash } from '../../lib/board-terms.js'

// Board members' elected roles and terms. Only free-text chair/secretary names
// on a meeting existed before, so nothing said who held which role when.
// `User.isBoard` still decides who can use the board tools.

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

const boardTermRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/governance/board',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(CurrentBoardSchema, 'CurrentBoard'),
      },
    },
    async (request, reply) => {
      const query = BoardOnDateQuerySchema.safeParse(request.query ?? {})
      if (!query.success) return reply.status(400).send({ error: 'Invalid date' })
      // Who held which role on a past day (whose signature, whose decision).
      const now = query.data.on ?? new Date()
      const terms = await fastify.prisma.governanceBoardTerm.findMany({
        where: {
          termStart: { lte: now },
          OR: [{ termEnd: null }, { termEnd: { gt: now } }],
        },
        // Postgres orders an enum by its declared order: chair first.
        orderBy: [{ role: 'asc' }, { displayName: 'asc' }],
        select: {
          id: true,
          role: true,
          displayName: true,
          termStart: true,
          termEnd: true,
          user: { select: { username: true } },
        },
      })
      return reply.send(
        terms.map(({ user, ...term }) => ({ ...term, username: user?.username ?? null })),
      )
    },
  )

  fastify.get(
    '/api/admin/governance/board-terms',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(GovernanceBoardTermListSchema, 'GovernanceBoardTermList'),
      },
    },
    async (_request, reply) =>
      reply.send(
        await fastify.prisma.governanceBoardTerm.findMany({
          orderBy: [{ termStart: 'desc' }, { role: 'asc' }],
          select: TERM_SELECT,
        }),
      ),
  )

  fastify.post(
    '/api/admin/governance/board-terms',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponses([
          {
            status: 201,
            schema: GovernanceBoardTermListSchema.element,
            name: 'GovernanceBoardTerm',
          },
        ]),
      },
    },
    async (request, reply) => {
      const parsed = CreateGovernanceBoardTermSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      const { userId, role, termStart, termEnd, meetingId } = parsed.data

      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true, isMember: true },
      })
      if (!user?.isMember) {
        return reply.status(400).send({ error: 'Board terms are for members of the association' })
      }
      if (meetingId) {
        const meeting = await fastify.prisma.governanceMeeting.findUnique({
          where: { id: meetingId },
          select: { id: true },
        })
        if (!meeting) return reply.status(400).send({ error: 'Meeting not found' })
      }
      const clash = await boardTermClash(fastify.prisma, {
        userId,
        role,
        termStart,
        termEnd: termEnd ?? null,
      })
      if (clash) return reply.status(409).send({ error: clash })

      const term = await fastify.prisma.governanceBoardTerm.create({
        data: {
          userId,
          displayName: user.displayName,
          role,
          termStart,
          termEnd,
          meetingId,
          createdById: request.sessionUser!.id,
        },
        select: TERM_SELECT,
      })
      await auditLog(fastify.prisma, {
        action: 'BOARD_TERM_RECORD',
        actorId: request.sessionUser!.id,
        targetId: term.id,
        meta: { userId, displayName: term.displayName, role, termStart, termEnd: termEnd ?? null },
      })
      return reply.status(201).send(term)
    },
  )

  fastify.patch(
    '/api/admin/governance/board-terms/:id',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(GovernanceBoardTermListSchema.element, 'GovernanceBoardTerm'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const parsed = EndGovernanceBoardTermSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      const { termEnd, endReason } = parsed.data

      const existing = await fastify.prisma.governanceBoardTerm.findUnique({ where: { id } })
      if (!existing) return reply.status(404).send({ error: 'Board term not found' })
      if (termEnd <= existing.termStart) {
        return reply.status(400).send({ error: 'The term must end after it starts' })
      }
      if (existing.termEnd && termEnd > existing.termEnd) {
        return reply
          .status(400)
          .send({ error: 'A term can be ended early, not extended: record a new term instead' })
      }
      const term = await fastify.prisma.governanceBoardTerm.update({
        where: { id },
        data: { termEnd, endReason: endReason ?? existing.endReason },
        select: TERM_SELECT,
      })
      if (existing.termEnd?.getTime() !== termEnd.getTime() || endReason !== undefined) {
        await auditLog(fastify.prisma, {
          action: 'BOARD_TERM_END',
          actorId: request.sessionUser!.id,
          targetId: id,
          meta: {
            displayName: existing.displayName,
            role: existing.role,
            termEnd,
            ...(endReason ? { endReason } : {}),
          },
        })
      }
      return reply.send(term)
    },
  )
}

export default boardTermRoutes
