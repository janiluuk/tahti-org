// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { mediaQueue } from '../../lib/queue.js'

// M13 — artist newsletter management (auth required)
const newsletterMeRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/newsletter/subscribers — subscriber count + recent growth
  fastify.get(
    '/api/me/newsletter/subscribers',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!

      const [total, confirmed, recent] = await Promise.all([
        fastify.prisma.newsletterSubscriber.count({ where: { artistUserId: user.id } }),
        fastify.prisma.newsletterSubscriber.count({
          where: { artistUserId: user.id, confirmedAt: { not: null }, unsubscribedAt: null },
        }),
        fastify.prisma.newsletterSubscriber.count({
          where: {
            artistUserId: user.id,
            confirmedAt: { not: null, gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
            unsubscribedAt: null,
          },
        }),
      ])

      return reply.send({ total, confirmed, newLast30Days: recent })
    },
  )

  // POST /api/me/newsletter/drafts — save a draft
  fastify.post('/api/me/newsletter/drafts', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const body = request.body as { subject?: string; bodyMd?: string }

    const subject = body.subject?.trim()
    const bodyMd = body.bodyMd?.trim()

    if (!subject) return reply.status(400).send({ error: 'subject is required' })
    if (!bodyMd) return reply.status(400).send({ error: 'bodyMd is required' })

    const draft = await fastify.prisma.newsletterDraft.create({
      data: { userId: user.id, subject, bodyMd, state: 'DRAFT' },
    })

    return reply.status(201).send(draft)
  })

  // GET /api/me/newsletter/drafts — list drafts + past sends
  fastify.get('/api/me/newsletter/drafts', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!

    const drafts = await fastify.prisma.newsletterDraft.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        subject: true,
        state: true,
        sentAt: true,
        createdAt: true,
        _count: { select: { sends: true } },
      },
    })

    return reply.send(drafts)
  })

  // POST /api/me/newsletter/send/:draftId — queue for delivery
  fastify.post(
    '/api/me/newsletter/send/:draftId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const { draftId } = request.params as { draftId: string }

      const draft = await fastify.prisma.newsletterDraft.findFirst({
        where: { id: draftId, userId: user.id },
      })

      if (!draft) return reply.status(404).send({ error: 'Draft not found' })
      if (draft.state !== 'DRAFT') {
        return reply.status(409).send({ error: 'Draft already sent or queued' })
      }

      // Per-tier rate limiting: FREE=1/week, ARTIST=4/week, STUDIO=unlimited
      const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000)
      const sentThisWeek = await fastify.prisma.newsletterDraft.count({
        where: { userId: user.id, state: 'SENT', sentAt: { gte: weekAgo } },
      })

      const weeklyLimit = user.tier === 'STUDIO' ? Infinity : user.tier === 'ARTIST' ? 4 : 1
      if (sentThisWeek >= weeklyLimit) {
        return reply.status(429).send({
          error: `Weekly newsletter limit reached (${weeklyLimit} for your tier)`,
        })
      }

      // Get confirmed subscribers
      const subscribers = await fastify.prisma.newsletterSubscriber.findMany({
        where: { artistUserId: user.id, confirmedAt: { not: null }, unsubscribedAt: null },
        select: { id: true },
      })

      if (subscribers.length === 0) {
        return reply.status(400).send({ error: 'No confirmed subscribers to send to' })
      }

      // Create send rows in bulk and update draft state
      await fastify.prisma.$transaction([
        fastify.prisma.newsletterSend.createMany({
          data: subscribers.map((s) => ({
            draftId,
            subscriberId: s.id,
            state: 'QUEUED',
          })),
        }),
        fastify.prisma.newsletterDraft.update({
          where: { id: draftId },
          data: { state: 'QUEUED' },
        }),
      ])

      // Enqueue the dispatch job
      await mediaQueue.add('newsletter-dispatch', { draftId, userId: user.id })

      return reply.send({ draftId, queued: subscribers.length })
    },
  )
}

export default newsletterMeRoutes
