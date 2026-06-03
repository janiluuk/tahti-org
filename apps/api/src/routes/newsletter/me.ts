// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  DraftIdParamSchema,
  NewsletterDraftSchema,
  NewsletterSendSchema,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { mediaQueue } from '../../lib/queue.js'
import { artistOffersFanNewsletter, fanOnlyNewsletterSubscriberIds } from '../../lib/fan-perks.js'

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

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
    const parsed = NewsletterDraftSchema.safeParse(request.body)
    if (!parsed.success) return zodError(reply, parsed.error)
    const body = parsed.data

    const draft = await fastify.prisma.newsletterDraft.create({
      data: {
        userId: user.id,
        subject: body.subject,
        bodyMd: body.bodyMd,
        state: 'DRAFT',
        subscribersOnly: body.subscribersOnly ?? false,
      },
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
        subscribersOnly: true,
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
      const routeParams = parseRouteParams(DraftIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { draftId } = routeParams
      const parsed = NewsletterSendSchema.safeParse(request.body ?? {})
      if (!parsed.success) return zodError(reply, parsed.error)
      const body = parsed.data

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

      let subscriberIds: string[]
      const fanAudience = body.audience === 'fans' || draft.subscribersOnly === true

      if (fanAudience) {
        if (!(await artistOffersFanNewsletter(fastify.prisma, user.id))) {
          return reply.status(400).send({
            error: 'Add FAN_NEWSLETTER to an active fan tier before sending fan-only mail',
          })
        }
        subscriberIds = await fanOnlyNewsletterSubscriberIds(fastify.prisma, user.id)
      } else {
        const subscribers = await fastify.prisma.newsletterSubscriber.findMany({
          where: { artistUserId: user.id, confirmedAt: { not: null }, unsubscribedAt: null },
          select: { id: true },
        })
        subscriberIds = subscribers.map((s) => s.id)
      }

      if (subscriberIds.length === 0) {
        return reply.status(400).send({
          error: fanAudience
            ? 'No confirmed fan subscribers on your list'
            : 'No confirmed subscribers to send to',
        })
      }

      // Create send rows in bulk and update draft state
      await fastify.prisma.$transaction([
        fastify.prisma.newsletterSend.createMany({
          data: subscriberIds.map((subscriberId) => ({
            draftId,
            subscriberId,
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

      return reply.send({
        draftId,
        queued: subscriberIds.length,
        audience: fanAudience ? 'fans' : 'all',
      })
    },
  )
}

export default newsletterMeRoutes
