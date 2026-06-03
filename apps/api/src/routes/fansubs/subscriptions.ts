// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  FanSubCheckoutSchema,
  IdParamSchema,
  UsernameParamSchema,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import {
  stripeEnabled,
  createStripeCustomer,
  createFanSubCheckoutSession,
} from '../../lib/stripe.js'
import { config } from '../../config.js'
import {
  activateSubscription,
  markFanSubCanceledAtPeriodEnd,
  recordFanSubPayment,
} from '../../lib/fansub.js'

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000

const fanSubscriptionRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/u/:username/subscribe — subscribe to an artist tier
  fastify.post(
    '/api/v1/u/:username/subscribe',
    { preHandler: requireAuth },
    async (request, reply) => {
      const subscriber = request.sessionUser!
      const routeParams = parseRouteParams(UsernameParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { username } = routeParams
      const parsed = FanSubCheckoutSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const { tierId } = parsed.data

      const artist = await fastify.prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          stripeConnectAccountId: true,
          stripeConnectChargesEnabled: true,
        },
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

      // Production: Stripe Checkout (Connect destination charge). Block until the
      // artist's Connect account can accept charges (Topic 10 — option A).
      if (stripeEnabled) {
        if (!artist.stripeConnectAccountId || !artist.stripeConnectChargesEnabled) {
          return reply.status(503).send({ error: 'Subscriptions open soon for this artist' })
        }

        let customerId = subscriber.stripeCustomerId
        if (!customerId) {
          try {
            customerId = await createStripeCustomer({
              email: subscriber.email,
              userId: subscriber.id,
            })
            await fastify.prisma.user.update({
              where: { id: subscriber.id },
              data: { stripeCustomerId: customerId },
            })
          } catch (err) {
            request.log.error({ err }, 'fan-sub customer creation failed')
            return reply.status(502).send({ error: 'Could not start checkout' })
          }
        }

        try {
          const session = await createFanSubCheckoutSession({
            customerId,
            connectedAccountId: artist.stripeConnectAccountId,
            successUrl: `${config.appUrl}/u/${username}/subscribe?subscribed=1`,
            cancelUrl: `${config.appUrl}/u/${username}/subscribe?canceled=1`,
            tierName: tier.name,
            amountCents: tier.amountCents,
            metadata: {
              artistUserId: artist.id,
              subscriberUserId: subscriber.id,
              tierName: tier.name,
              amountCents: String(tier.amountCents),
            },
          })
          return reply.send({ checkoutUrl: session.url, sessionId: session.id })
        } catch (err) {
          request.log.error({ err }, 'fan-sub checkout failed')
          return reply.status(502).send({ error: 'Could not start checkout' })
        }
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
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const sub = await fastify.prisma.fanSubscription.findFirst({
        where: { id, subscriberUserId: user.id },
      })
      if (!sub) return reply.status(404).send({ error: 'Subscription not found' })

      await markFanSubCanceledAtPeriodEnd(fastify.prisma, { subscriptionId: id })
      const updated = await fastify.prisma.fanSubscription.findUnique({
        where: { id },
        select: { id: true, state: true, canceledAt: true, currentPeriodEnd: true },
      })
      return reply.send({
        ...updated,
        accessUntil: updated!.currentPeriodEnd,
        message:
          'Canceled — fan perks remain until the end of the billing period, then 7 days grace.',
      })
    },
  )
}

export default fanSubscriptionRoutes
