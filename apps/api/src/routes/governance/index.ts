// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  CreateMotionSchema,
  GovernanceMemberListSchema,
  IdParamSchema,
  MotionCommentListSchema,
  MotionCommentSchema,
  MotionDetailSchema,
  MotionListSchema,
  MotionRefResponseSchema,
  PatchMotionSchema,
  PostMotionCommentSchema,
  VoteCastResponseSchema,
  VoteMotionSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireMember, requireBoard } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'

// M10 — Member governance.
//
// Voting is ADVISORY for Y1 (docs/planning-decisions.md, Topic 11). Motions
// carry an `advisory` flag; binding AGM decisions still require a live meeting
// until the bylaws authorize asynchronous electronic voting.
//
// To avoid a bandwagon effect, per-choice tallies are hidden while a motion is
// OPEN and only revealed once it CLOSES. The requesting member can always see
// whether (and how) they voted.

const governanceRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/governance/members — members-only directory (PRH register view)
  fastify.get(
    '/api/v1/governance/members',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(GovernanceMemberListSchema, 'GovernanceMembers'),
      },
    },
    async (_request, reply) => {
      const members = await fastify.prisma.user.findMany({
        where: { isMember: true },
        orderBy: [{ memberNumber: 'asc' }, { memberSince: 'asc' }],
        select: {
          memberNumber: true,
          displayName: true,
          username: true,
          memberSince: true,
          isBoard: true,
          channel: { select: { slug: true } },
        },
      })

      return reply.send(
        members.map((m) => ({
          memberNumber: m.memberNumber,
          displayName: m.displayName,
          username: m.username,
          memberSince: m.memberSince,
          isBoard: m.isBoard,
          channelSlug: m.channel?.slug ?? null,
        })),
      )
    },
  )

  // GET /api/v1/governance/motions — list motions (members-only)
  fastify.get(
    '/api/v1/governance/motions',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(MotionListSchema, 'MotionList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const motions = await fastify.prisma.motion.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          proposer: { select: { displayName: true, username: true } },
          _count: { select: { votes: true, comments: true } },
          // Fetched for every state (not just CLOSED) since per-motion vote
          // counts are small (bounded by member count) and this lets youVoted
          // /yourChoice/tally all come from one query instead of a second
          // lookup — this page has no per-motion detail fetch, so the list
          // response is the only place a CLOSED motion's tally is ever shown.
          votes: { select: { userId: true, choice: true } },
        },
      })

      return reply.send(
        motions.map((m) => {
          const myVote = m.votes.find((v) => v.userId === user.id)
          let tally: { YES: number; NO: number; ABSTAIN: number } | undefined
          if (m.state === 'CLOSED') {
            tally = { YES: 0, NO: 0, ABSTAIN: 0 }
            for (const v of m.votes) tally[v.choice] += 1
          }
          return {
            id: m.id,
            title: m.title,
            state: m.state,
            advisory: m.advisory,
            openAt: m.openAt,
            closeAt: m.closeAt,
            proposer: m.proposer.displayName,
            totalVotes: m._count.votes,
            youVoted: Boolean(myVote),
            yourChoice: myVote?.choice ?? null,
            commentCount: m._count.comments,
            tally,
          }
        }),
      )
    },
  )

  // POST /api/v1/governance/motions — board posts a motion (starts as DRAFT)
  fastify.post(
    '/api/v1/governance/motions',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['governance'],
        response: openApiResponses([
          { status: 201, schema: MotionRefResponseSchema, name: 'MotionRef' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = CreateMotionSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const { title, description, openAt, closeAt, advisory } = parsed.data

      const motion = await fastify.prisma.motion.create({
        data: {
          title,
          description,
          proposedBy: user.id,
          advisory: advisory !== false,
          openAt,
          closeAt,
          state: 'DRAFT',
        },
      })

      await auditLog(fastify.prisma, {
        action: 'MOTION_CREATE',
        actorId: user.id,
        targetId: motion.id,
        meta: { title },
      })

      return reply.status(201).send({ id: motion.id, state: motion.state })
    },
  )

  // GET /api/v1/governance/motions/:id — detail; tallies revealed only on CLOSE
  fastify.get(
    '/api/v1/governance/motions/:id',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(MotionDetailSchema, 'MotionDetail'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const motion = await fastify.prisma.motion.findUnique({
        where: { id },
        include: {
          proposer: { select: { displayName: true, username: true } },
          votes: { select: { userId: true, choice: true } },
          _count: { select: { comments: true } },
        },
      })
      if (!motion) return reply.status(404).send({ error: 'Motion not found' })

      const myVote = motion.votes.find((v) => v.userId === user.id)

      const base = {
        id: motion.id,
        title: motion.title,
        description: motion.description,
        state: motion.state,
        advisory: motion.advisory,
        openAt: motion.openAt,
        closeAt: motion.closeAt,
        proposer: motion.proposer.displayName,
        totalVotes: motion.votes.length,
        youVoted: Boolean(myVote),
        yourChoice: myVote?.choice ?? null,
        commentCount: motion._count.comments,
      }

      // Per-choice tally is published only once voting has closed.
      if (motion.state === 'CLOSED') {
        const tally = { YES: 0, NO: 0, ABSTAIN: 0 }
        for (const v of motion.votes) tally[v.choice] += 1
        return reply.send({ ...base, tally })
      }

      return reply.send(base)
    },
  )

  // PATCH /api/v1/governance/motions/:id — board state transitions (open/close)
  fastify.patch(
    '/api/v1/governance/motions/:id',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['governance'],
        response: openApiResponse(MotionRefResponseSchema, 'MotionRef'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const parsed = PatchMotionSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const body = parsed.data

      const motion = await fastify.prisma.motion.findUnique({ where: { id } })
      if (!motion) return reply.status(404).send({ error: 'Motion not found' })

      // Title/description edits allowed only while still in DRAFT.
      const data: Record<string, unknown> = {}
      if (body.title || body.description) {
        if (motion.state !== 'DRAFT') {
          return reply.status(409).send({ error: 'Can only edit a motion while it is a draft' })
        }
        if (body.title) data.title = body.title
        if (body.description) data.description = body.description
      }

      if (body.state) {
        const target = body.state
        const valid: Record<string, string> = { DRAFT: 'OPEN', OPEN: 'CLOSED' }
        if (target !== valid[motion.state]) {
          return reply
            .status(409)
            .send({ error: `Cannot transition motion from ${motion.state} to ${target}` })
        }
        data.state = target
        await auditLog(fastify.prisma, {
          action: target === 'OPEN' ? 'MOTION_OPEN' : 'MOTION_CLOSE',
          actorId: user.id,
          targetId: motion.id,
        })
      }

      if (Object.keys(data).length === 0) {
        return reply.status(400).send({ error: 'Nothing to update' })
      }

      const updated = await fastify.prisma.motion.update({ where: { id }, data })
      return reply.send({ id: updated.id, state: updated.state })
    },
  )

  // POST /api/v1/governance/motions/:id/vote — one vote per member while OPEN
  fastify.post(
    '/api/v1/governance/motions/:id/vote',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponses([
          { status: 201, schema: VoteCastResponseSchema, name: 'VoteCast' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const parsed = VoteMotionSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const choice = parsed.data.choice

      const motion = await fastify.prisma.motion.findUnique({ where: { id } })
      if (!motion) return reply.status(404).send({ error: 'Motion not found' })

      const now = new Date()
      if (motion.state !== 'OPEN') {
        return reply.status(409).send({ error: 'Motion is not open for voting' })
      }
      if (now < motion.openAt || now > motion.closeAt) {
        return reply.status(409).send({ error: 'Voting window is not currently open' })
      }

      const existing = await fastify.prisma.vote.findUnique({
        where: { motionId_userId: { motionId: id, userId: user.id } },
      })
      if (existing) {
        return reply.status(409).send({ error: 'You have already voted on this motion' })
      }

      await fastify.prisma.vote.create({
        data: { motionId: id, userId: user.id, choice },
      })

      await auditLog(fastify.prisma, {
        action: 'VOTE_CAST',
        actorId: user.id,
        targetId: id,
        meta: { choice },
      })

      return reply.status(201).send({ ok: true, choice })
    },
  )

  // GET /api/v1/governance/motions/:id/comments — discussion thread, members-only,
  // visible in every state (including CLOSED, so the record of discussion persists).
  fastify.get(
    '/api/v1/governance/motions/:id/comments',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(MotionCommentListSchema, 'MotionCommentList'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const motion = await fastify.prisma.motion.findUnique({ where: { id }, select: { id: true } })
      if (!motion) return reply.status(404).send({ error: 'Motion not found' })

      const comments = await fastify.prisma.motionComment.findMany({
        where: { motionId: id },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { displayName: true } } },
      })

      return reply.send(
        comments.map((c) => ({
          id: c.id.toString(),
          body: c.body,
          authorId: c.authorId,
          authorDisplayName: c.author?.displayName ?? null,
          createdAt: c.createdAt,
        })),
      )
    },
  )

  // POST /api/v1/governance/motions/:id/comments — post to the discussion thread.
  // Allowed while DRAFT (the "circulation" period) or OPEN (discussion continues
  // alongside voting); blocked once CLOSED, mirroring the vote-after-close rule —
  // the matter is settled, further comments belong on a new motion.
  fastify.post(
    '/api/v1/governance/motions/:id/comments',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponses([
          { status: 201, schema: MotionCommentSchema, name: 'MotionComment' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const parsed = PostMotionCommentSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const motion = await fastify.prisma.motion.findUnique({
        where: { id },
        select: { state: true },
      })
      if (!motion) return reply.status(404).send({ error: 'Motion not found' })
      if (motion.state === 'CLOSED') {
        return reply.status(409).send({ error: 'This motion is closed to further discussion' })
      }

      const comment = await fastify.prisma.motionComment.create({
        data: { motionId: id, authorId: user.id, body: parsed.data.body },
        include: { author: { select: { displayName: true } } },
      })

      await auditLog(fastify.prisma, {
        action: 'MOTION_COMMENT_CREATE',
        actorId: user.id,
        targetId: id,
      })

      return reply.status(201).send({
        id: comment.id.toString(),
        body: comment.body,
        authorId: comment.authorId,
        authorDisplayName: comment.author?.displayName ?? null,
        createdAt: comment.createdAt,
      })
    },
  )
}

export default governanceRoutes
