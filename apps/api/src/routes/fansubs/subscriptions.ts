// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { stripeEnabled } from '../../lib/stripe.js'
import { activateSubscription, recordFanSubPayment } from '../../lib/fansub.js'

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000

const fanSubscriptionRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/u/:username/subscribe — subscribe to an artist tier
  fastify.post(
    '/api/v1/u/:username/subscribe',
    { preHandler: requireAuth },
    async (request, reply) => {
      const subscriber = request.sessionUser!
      const { username } = request.params as { username: string }
      const { tierId } = (request.body as { tierId?: string }) ?? {}

      if (!tierId) return reply.status(400).send({ error: 'tierId is required' })

      const artist = await fastify.prisma.user.findUnique({
        where: { username },
        select: { id: true },
      })
      if (!artist) return reply.status(404).send({ error: 'Artist not found' })

      if (artist.id === subscriber.id) {
        return reply.status(400).send({ error: 'You cannot subscribe to yourself' })
      }

      const tier = await fastify.prisma.fanTier.findFirst({
        where: { id: tierId, artistUserId: artist.id, active: true },
      })
      if (!tier) return reply.status(404).send({ error: 'Tier not found' })

      const existing = await fastify.prisma.fanSubscription.findUnique({
        where: {
          artistUserId_subscriberUserId: {
            artistUserId: artist.id,
            subscriberUserId: subscriber.id,
          },
        },
        select: { state: true },
      })
      if (existing && existing.state === 'ACTIVE') {
        return reply.status(409).send({ error: 'Already subscribed to this artist' })
      }

      // Production: create a Stripe Checkout session and let the webhook
      // activate the subscription. That network call needs the Stripe SDK +
      // live keys (the remaining wiring step), so we fail loudly rather than
      // silently granting a free subscription.
      if (stripeEnabled) {
        return reply.status(501).send({ error: 'Stripe Checkout is not wired yet' })
      }

      // Dev/test: activate immediately and record the first period's payment.
      const now = new Date()
      const periodEnd = new Date(now.getTime() + PERIOD_MS)
      const sub = await activateSubscription(fastify.prisma, {
        artistUserId: artist.id,
        subscriberUserId: subscriber.id,
        tierName: tier.name,
        amountCents: tier.amountCents,
        stripeSubscriptionId: `dev_${artist.id}_${subscriber.id}`,
        currentPeriodEnd: periodEnd,
      })
      await recordFanSubPayment(fastify.prisma, {
        subscriptionId: sub.id,
        artistUserId: artist.id,
        grossCents: tier.amountCents,
        periodStart: now,
        periodEnd,
      })

      return reply.status(201).send({
        activated: true,
        subscriptionId: sub.id,
        tierName: sub.tierName,
        amountCents: sub.amountCents,
        currentPeriodEnd: sub.currentPeriodEnd,
      })
    },
  )

  // GET /api/me/subscriptions — subscriptions where I am the subscriber
  fastify.get('/api/me/subscriptions', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const subs = await fastify.prisma.fanSubscription.findMany({
      where: { subscriberUserId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tierName: true,
        amountCents: true,
        state: true,
        currentPeriodEnd: true,
        canceledAt: true,
        artist: { select: { username: true, displayName: true } },
      },
    })
    return reply.send(subs)
  })

  // POST /api/me/subscriptions/:id/cancel — cancel; access lasts until period end
  fastify.post(
    '/api/me/subscriptions/:id/cancel',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const { id } = request.params as { id: string }

      const sub = await fastify.prisma.fanSubscription.findFirst({
        where: { id, subscriberUserId: user.id },
      })
      if (!sub) return reply.status(404).send({ error: 'Subscription not found' })

      const updated = await fastify.prisma.fanSubscription.update({
        where: { id },
        data: { state: 'CANCELED', canceledAt: new Date() },
        select: { id: true, state: true, canceledAt: true, currentPeriodEnd: true },
      })
      return reply.send(updated)
    },
  )
}

export default fanSubscriptionRoutes
