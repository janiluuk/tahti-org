// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  FanSubActivatedResponseSchema,
  FanSubCancelResponseSchema,
  FanSubCheckoutSchema,
  FanSubCheckoutUrlResponseSchema,
  FanSubSubscriptionListSchema,
  BillingPortalUrlResponseSchema,
  IdParamSchema,
  UsernameParamSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import {
  stripeEnabled,
  createStripeCustomer,
  createFanSubCheckoutSession,
  createBillingPortalSession,
  setStripeSubscriptionCancelAtPeriodEnd,
} from '../../lib/stripe.js'
import { config } from '../../config.js'
import {
  activateSubscription,
  isDevStubSubscriptionId,
  markFanSubCanceledAtPeriodEnd,
  recordFanSubPayment,
} from '../../lib/fansub.js'

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000

const fanSubscriptionRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/v1/u/:username/subscribe — subscribe to an artist tier
  fastify.post(
    '/api/v1/u/:username/subscribe',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['fansubs'],
        description: 'M19: start fan subscription (Stripe Checkout or dev activate)',
        response: openApiResponses([
          { status: 200, schema: FanSubCheckoutUrlResponseSchema, name: 'FanSubCheckoutUrl' },
          { status: 201, schema: FanSubActivatedResponseSchema, name: 'FanSubActivated' },
        ]),
      },
    },
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
        select: { state: true, currentPeriodEnd: true },
      })
      if (existing && existing.state === 'ACTIVE') {
        return reply.status(409).send({ error: 'Already subscribed to this artist' })
      }
      // The canceled Stripe subscription is still live until period end, so a new
      // checkout here would bill the fan twice.
      if (existing && existing.state === 'CANCELED' && existing.currentPeriodEnd > new Date()) {
        return reply.status(409).send({
          error: `Your canceled subscription to this artist runs until ${existing.currentPeriodEnd.toISOString().slice(0, 10)}. Resume it from the billing portal in your account settings, or subscribe again after it ends.`,
        })
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
  fastify.get(
    '/api/me/subscriptions',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['fansubs'],
        response: openApiResponse(FanSubSubscriptionListSchema, 'FanSubSubscriptionList'),
      },
    },
    async (request, reply) => {
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
    },
  )

  // POST /api/me/subscriptions/:id/cancel — cancel; access lasts until period end
  fastify.post(
    '/api/me/subscriptions/:id/cancel',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['fansubs'],
        response: openApiResponse(FanSubCancelResponseSchema, 'FanSubCancel'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const sub = await fastify.prisma.fanSubscription.findFirst({
        where: { id, subscriberUserId: user.id },
      })
      if (!sub) return reply.status(404).send({ error: 'Subscription not found' })
      if (sub.state === 'EXPIRED') {
        return reply.status(409).send({ error: 'This subscription has already ended' })
      }

      if (stripeEnabled && !isDevStubSubscriptionId(sub.stripeSubscriptionId)) {
        try {
          await setStripeSubscriptionCancelAtPeriodEnd(sub.stripeSubscriptionId, true)
        } catch (err) {
          request.log.error({ err, subscriptionId: sub.id }, 'fan-sub Stripe cancel failed')
          return reply
            .status(502)
            .send({ error: 'Could not cancel the subscription with Stripe. Please try again.' })
        }
      }

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

  // GET /api/v1/fansubs/portal — Stripe Customer Portal for fan subscriptions
  fastify.get(
    '/api/v1/fansubs/portal',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['fansubs'],
        description: 'M19: Stripe billing portal for fan subscriptions',
        response: openApiResponse(BillingPortalUrlResponseSchema, 'BillingPortalUrl'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!

      // Canceled subs still inside their paid period count: the portal is where a
      // fan resumes one.
      const activeSub = await fastify.prisma.fanSubscription.findFirst({
        where: {
          subscriberUserId: user.id,
          OR: [{ state: 'ACTIVE' }, { state: 'CANCELED', currentPeriodEnd: { gt: new Date() } }],
        },
      })
      if (!activeSub) {
        return reply.status(400).send({ error: 'No active fan subscriptions' })
      }

      if (!stripeEnabled) {
        return reply.status(400).send({
          error: 'Billing portal is only available when Stripe is configured',
        })
      }

      let customerId = user.stripeCustomerId
      if (!customerId) {
        try {
          customerId = await createStripeCustomer({ email: user.email, userId: user.id })
          await fastify.prisma.user.update({
            where: { id: user.id },
            data: { stripeCustomerId: customerId },
          })
        } catch (err) {
          request.log.error({ err }, 'fan-sub portal customer creation failed')
          return reply.status(502).send({ error: 'Could not open billing portal' })
        }
      }

      try {
        const session = await createBillingPortalSession({
          customerId,
          returnUrl: `${config.appUrl}/dashboard?fansubs=portal`,
        })
        return reply.send({ portalUrl: session.url })
      } catch (err) {
        request.log.error({ err }, 'fan-sub billing portal failed')
        return reply.status(502).send({ error: 'Could not open billing portal' })
      }
    },
  )
}

export default fanSubscriptionRoutes
