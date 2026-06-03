// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
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

const VALID_CHOICES = ['YES', 'NO', 'ABSTAIN'] as const
type Choice = (typeof VALID_CHOICES)[number]

const governanceRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/governance/members — members-only directory (PRH register view)
  fastify.get('/api/v1/governance/members', { preHandler: requireMember }, async (_request, reply) => {
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
  })

  // GET /api/v1/governance/motions — list motions (members-only)
  fastify.get('/api/v1/governance/motions', { preHandler: requireMember }, async (request, reply) => {
    const user = request.sessionUser!
    const motions = await fastify.prisma.motion.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        proposer: { select: { displayName: true, username: true } },
        _count: { select: { votes: true } },
        votes: { where: { userId: user.id }, select: { choice: true } },
      },
    })

    return reply.send(
      motions.map((m) => ({
        id: m.id,
        title: m.title,
        state: m.state,
        advisory: m.advisory,
        openAt: m.openAt,
        closeAt: m.closeAt,
        proposer: m.proposer.displayName,
        totalVotes: m._count.votes,
        youVoted: m.votes.length > 0,
        yourChoice: m.votes[0]?.choice ?? null,
      })),
    )
  })

  // POST /api/v1/governance/motions — board posts a motion (starts as DRAFT)
  fastify.post('/api/v1/governance/motions', { preHandler: requireBoard }, async (request, reply) => {
    const user = request.sessionUser!
    const body = request.body as {
      title?: string
      description?: string
      openAt?: string
      closeAt?: string
      advisory?: boolean
    }

    const title = body.title?.trim()
    const description = body.description?.trim()
    if (!title) return reply.status(400).send({ error: 'title is required' })
    if (!description) return reply.status(400).send({ error: 'description is required' })
    if (!body.openAt || !body.closeAt) {
      return reply.status(400).send({ error: 'openAt and closeAt are required' })
    }

    const openAt = new Date(body.openAt)
    const closeAt = new Date(body.closeAt)
    if (Number.isNaN(openAt.getTime()) || Number.isNaN(closeAt.getTime())) {
      return reply.status(400).send({ error: 'openAt and closeAt must be valid dates' })
    }
    if (closeAt <= openAt) {
      return reply.status(400).send({ error: 'closeAt must be after openAt' })
    }

    const motion = await fastify.prisma.motion.create({
      data: {
        title: title.slice(0, 200),
        description: description.slice(0, 10000),
        proposedBy: user.id,
        advisory: body.advisory !== false,
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
  })

  // GET /api/v1/governance/motions/:id — detail; tallies revealed only on CLOSE
  fastify.get('/api/v1/governance/motions/:id', { preHandler: requireMember }, async (request, reply) => {
    const user = request.sessionUser!
    const { id } = request.params as { id: string }

    const motion = await fastify.prisma.motion.findUnique({
      where: { id },
      include: {
        proposer: { select: { displayName: true, username: true } },
        votes: { select: { userId: true, choice: true } },
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
    }

    // Per-choice tally is published only once voting has closed.
    if (motion.state === 'CLOSED') {
      const tally = { YES: 0, NO: 0, ABSTAIN: 0 }
      for (const v of motion.votes) tally[v.choice] += 1
      return reply.send({ ...base, tally })
    }

    return reply.send(base)
  })

  // PATCH /api/v1/governance/motions/:id — board state transitions (open/close)
  fastify.patch('/api/v1/governance/motions/:id', { preHandler: requireBoard }, async (request, reply) => {
    const user = request.sessionUser!
    const { id } = request.params as { id: string }
    const body = request.body as { state?: string; title?: string; description?: string }

    const motion = await fastify.prisma.motion.findUnique({ where: { id } })
    if (!motion) return reply.status(404).send({ error: 'Motion not found' })

    // Title/description edits allowed only while still in DRAFT.
    const data: Record<string, unknown> = {}
    if (body.title?.trim() || body.description?.trim()) {
      if (motion.state !== 'DRAFT') {
        return reply.status(409).send({ error: 'Can only edit a motion while it is a draft' })
      }
      if (body.title?.trim()) data.title = body.title.trim().slice(0, 200)
      if (body.description?.trim()) data.description = body.description.trim().slice(0, 10000)
    }

    if (body.state) {
      const target = body.state.toUpperCase()
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
  })

  // POST /api/v1/governance/motions/:id/vote — one vote per member while OPEN
  fastify.post(
    '/api/v1/governance/motions/:id/vote',
    { preHandler: requireMember },
    async (request, reply) => {
      const user = request.sessionUser!
      const { id } = request.params as { id: string }
      const body = request.body as { choice?: string }

      const choice = body.choice?.toUpperCase()
      if (!choice || !VALID_CHOICES.includes(choice as Choice)) {
        return reply.status(400).send({ error: 'choice must be YES, NO, or ABSTAIN' })
      }

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
        data: { motionId: id, userId: user.id, choice: choice as Choice },
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
}

export default governanceRoutes
