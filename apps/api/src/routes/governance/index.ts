// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  CreateMotionSchema,
  FeatureRequestQuarterlyReportListSchema,
  GovernanceMemberListSchema,
  IdParamSchema,
  MotionCommentListSchema,
  MotionCommentSchema,
  MotionCommentsBulkSchema,
  MotionDetailSchema,
  MotionListQuerySchema,
  MotionListSchema,
  MOTION_LIST_STATES,
  MotionRefResponseSchema,
  PatchMotionSchema,
  PostMotionCommentSchema,
  VoteCastResponseSchema,
  VoteMotionSchema,
  VoteRetractResponseSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireMember, requireBoard } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'
import { presignedGetUrl } from '../../lib/minio.js'
import type { MotionState, Prisma } from '@tahti/db'

const MOTION_STATE_SET = new Set<string>(MOTION_LIST_STATES)

function encodeMotionCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf8').toString('base64url')
}

function decodeMotionCursor(raw: string): { createdAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8')
    const [iso, id] = decoded.split('|')
    if (!iso || !id) return null
    const createdAt = new Date(iso)
    if (Number.isNaN(createdAt.getTime())) return null
    return { createdAt, id }
  } catch {
    return null
  }
}

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
      const parsed = MotionListQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid query',
        })
      }
      const { limit, cursor: cursorRaw } = parsed.data
      const states = parsed.data.state
        ? [
            ...new Set(
              parsed.data.state
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean),
            ),
          ]
        : []
      if (states.some((state) => !MOTION_STATE_SET.has(state))) {
        return reply.status(400).send({ error: 'Invalid motion state filter' })
      }
      const cursor = cursorRaw ? decodeMotionCursor(cursorRaw) : null
      if (cursorRaw && !cursor) {
        return reply.status(400).send({ error: 'Invalid cursor' })
      }

      const where: Prisma.MotionWhereInput = {}
      if (states.length > 0) {
        where.state = { in: states as MotionState[] }
      }
      if (cursor) {
        where.OR = [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ]
      }

      const motions = await fastify.prisma.motion.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
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

      const page = motions.slice(0, limit)
      const last = page[page.length - 1]
      if (motions.length > limit && last) {
        reply.header('x-next-cursor', encodeMotionCursor(last.createdAt, last.id))
      }

      return reply.send(
        page.map((m) => {
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
            eligibleMemberCount: m.eligibleMemberCount,
            tally,
          }
        }),
      )
    },
  )

  // POST /api/v1/governance/motions — members submit motion drafts; board opens them
  fastify.post(
    '/api/v1/governance/motions',
    {
      preHandler: requireMember,
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
          // A member may submit a proposal, but cannot mark it binding while
          // the official bylaws-driven voting workflow is not implemented.
          advisory: user.isBoard ? advisory !== false : true,
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
        eligibleMemberCount: motion.eligibleMemberCount,
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

      let eligibleMemberCount: number | undefined
      if (body.state) {
        const target = body.state
        const valid: Record<string, string> = { DRAFT: 'OPEN', OPEN: 'CLOSED' }
        if (target !== valid[motion.state]) {
          return reply
            .status(409)
            .send({ error: `Cannot transition motion from ${motion.state} to ${target}` })
        }
        data.state = target
        if (target === 'OPEN') {
          // Snapshot the eligible-voter denominator as of when voting opens,
          // not at read time — the live member count drifts after the fact
          // and a closed motion's "X of Y voted" turnout must stay accurate.
          eligibleMemberCount = await fastify.prisma.user.count({ where: { isMember: true } })
          data.eligibleMemberCount = eligibleMemberCount
        }
        await auditLog(fastify.prisma, {
          action: target === 'OPEN' ? 'MOTION_OPEN' : 'MOTION_CLOSE',
          actorId: user.id,
          targetId: motion.id,
          meta: eligibleMemberCount !== undefined ? { eligibleMemberCount } : undefined,
        })
      }

      if (Object.keys(data).length === 0) {
        return reply.status(400).send({ error: 'Nothing to update' })
      }

      const updated = await fastify.prisma.motion.update({ where: { id }, data })
      return reply.send({ id: updated.id, state: updated.state })
    },
  )

  // POST /api/v1/governance/motions/:id/vote — cast or change a vote while OPEN.
  // A second POST from the same member updates their existing choice rather
  // than erroring, matching the member-journey rule that a vote may be
  // changed up until the motion closes.
  fastify.post(
    '/api/v1/governance/motions/:id/vote',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponses([
          { status: 200, schema: VoteCastResponseSchema, name: 'VoteChanged' },
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
        if (existing.choice === choice) {
          return reply.status(200).send({ ok: true, choice })
        }
        await fastify.prisma.vote.update({
          where: { motionId_userId: { motionId: id, userId: user.id } },
          data: { choice, castAt: now },
        })
        await auditLog(fastify.prisma, {
          action: 'VOTE_CHANGE',
          actorId: user.id,
          targetId: id,
          meta: { recorded: true },
        })
        return reply.status(200).send({ ok: true, choice })
      }

      await fastify.prisma.vote.create({
        data: { motionId: id, userId: user.id, choice },
      })

      await auditLog(fastify.prisma, {
        action: 'VOTE_CAST',
        actorId: user.id,
        targetId: id,
        meta: { recorded: true },
      })

      return reply.status(201).send({ ok: true, choice })
    },
  )

  // DELETE /api/v1/governance/motions/:id/vote — retract a vote while OPEN.
  fastify.delete(
    '/api/v1/governance/motions/:id/vote',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(VoteRetractResponseSchema, 'VoteRetracted'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

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
      if (!existing) return reply.status(404).send({ error: 'You have not voted on this motion' })

      await fastify.prisma.vote.delete({
        where: { motionId_userId: { motionId: id, userId: user.id } },
      })

      await auditLog(fastify.prisma, {
        action: 'VOTE_RETRACT',
        actorId: user.id,
        targetId: id,
        meta: { recorded: true },
      })

      return reply.status(200).send({ ok: true })
    },
  )

  // GET /api/v1/governance/motions/comments?ids=id1,id2,... — discussion threads
  // for several motions in one request. Governance list pages need every open
  // (or, on the full history page, every) motion's comments up front; fetching
  // them one motion at a time doesn't scale past a handful of motions. Capped
  // at 100 ids to match the motions list's own cap.
  fastify.get(
    '/api/v1/governance/motions/comments',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(MotionCommentsBulkSchema, 'MotionCommentsBulk'),
      },
    },
    async (request, reply) => {
      const query = request.query as Record<string, unknown>
      const ids =
        typeof query.ids === 'string'
          ? [...new Set(query.ids.split(',').filter(Boolean))].slice(0, 100)
          : []
      if (ids.length === 0) return reply.send({})

      const comments = await fastify.prisma.motionComment.findMany({
        where: { motionId: { in: ids } },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { displayName: true } } },
      })

      const byMotion: Record<string, unknown[]> = Object.fromEntries(ids.map((id) => [id, []]))
      for (const c of comments) {
        byMotion[c.motionId]!.push({
          id: c.id.toString(),
          body: c.body,
          authorId: c.authorId,
          authorDisplayName: c.author?.displayName ?? null,
          createdAt: c.createdAt,
        })
      }

      return reply.send(byMotion)
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

  // GET /api/v1/governance/quarterly-reports — read-only member view of the
  // board's quarterly feature-request review reports (see
  // FeatureRequestQuarterlyReport + /api/admin/feature-requests/reports,
  // which stays board-only for *generating* them). Members can already vote
  // on and discuss feature requests as they happen — this is the "what
  // actually got decided" summary after the fact, mirroring the transparency
  // page's public board-resolutions list but scoped to feature requests.
  fastify.get(
    '/api/v1/governance/quarterly-reports',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(
          FeatureRequestQuarterlyReportListSchema,
          'GovernanceQuarterlyReportList',
        ),
      },
    },
    async (_request, reply) => {
      const rows = await fastify.prisma.featureRequestQuarterlyReport.findMany({
        orderBy: [{ year: 'desc' }, { quarter: 'desc' }],
        take: 12,
        include: { generatedBy: { select: { displayName: true } } },
      })

      const reports = await Promise.all(
        rows.map(async (r) => ({
          id: r.id.toString(),
          year: r.year,
          quarter: r.quarter,
          storageKey: r.storageKey,
          generatedAt: r.generatedAt,
          generatedByDisplayName: r.generatedBy.displayName,
          downloadUrl: await presignedGetUrl(r.storageKey, 3600).catch(() => null),
        })),
      )

      return reply.send(reports)
    },
  )
}

export default governanceRoutes
