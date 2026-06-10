// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  BillingPortalUrlResponseSchema,
  MembershipCheckoutBodySchema,
  MembershipCheckoutResponseSchema,
  MembershipStatusResponseSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'
import {
  stripeEnabled,
  createMembershipCheckoutSession,
  createStripeCustomer,
  createBillingPortalSession,
} from '../../lib/stripe.js'
import { activateMembership, membershipRenewalDueAt } from '../../lib/membership.js'

function safeAppReturnPath(path: string | undefined, fallback: string, appUrl: string): string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return fallback
  if (!path.startsWith('/signup') && !path.startsWith('/dashboard')) return fallback
  return `${appUrl.replace(/\/$/, '')}${path}`
}

const membershipRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/membership — current membership status
  fastify.get(
    '/api/me/membership',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['auth'],
        description: 'M1: membership status for dashboard',
        response: openApiResponse(MembershipStatusResponseSchema, 'MembershipStatus'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const membership = await fastify.prisma.membership.findUnique({
        where: { userId: user.id },
      })
      const renewalDueAt = membershipRenewalDueAt(user.memberSince)
      return reply.send({
        status: membership?.status ?? 'PENDING_EMAIL',
        isMember: user.isMember,
        memberNumber: user.memberNumber,
        memberSince: user.memberSince,
        tier: user.tier,
        priceCents: config.membership.priceCents,
        emailVerified: !!user.emailVerifiedAt,
        renewalDueAt,
        hasStripeSubscription: !!user.stripeMembershipSubscriptionId,
        subscriptionMigrationRequired:
          user.isMember && !user.stripeMembershipSubscriptionId && stripeEnabled,
      })
    },
  )

  // POST /api/me/membership/checkout — pay €40 annual membership
  fastify.post(
    '/api/me/membership/checkout',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['auth'],
        response: openApiResponse(MembershipCheckoutResponseSchema, 'MembershipCheckout'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const bodyParsed = MembershipCheckoutBodySchema.safeParse(request.body ?? {})
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: 'Invalid checkout options' })
      }
      const { successPath, cancelPath } = bodyParsed.data

      if (!user.emailVerifiedAt) {
        return reply.status(400).send({ error: 'Verify your email before paying for membership' })
      }

      const membership = await fastify.prisma.membership.findUnique({
        where: { userId: user.id },
      })
      if (membership?.status === 'PENDING_EMAIL') {
        return reply.status(400).send({ error: 'Verify your email first' })
      }

      if (user.isMember && user.stripeMembershipSubscriptionId) {
        return reply.status(409).send({
          error: 'You already have an active membership subscription — use Manage billing',
        })
      }

      if (user.isMember && !stripeEnabled) {
        return reply.status(409).send({ error: 'You are already a member' })
      }

      if (!stripeEnabled) {
        const result = await activateMembership(fastify.prisma, user.id, {
          stripeSessionId: `dev_${user.id}`,
        })
        return reply.send({
          activated: true,
          memberNumber: result.memberNumber,
          message: 'Membership activated (dev mode — no Stripe)',
        })
      }

      try {
        let customerId = user.stripeCustomerId
        if (!customerId) {
          customerId = await createStripeCustomer({ email: user.email, userId: user.id })
          await fastify.prisma.user.update({
            where: { id: user.id },
            data: { stripeCustomerId: customerId },
          })
        }

        const session = await createMembershipCheckoutSession({
          customerId,
          successUrl: safeAppReturnPath(
            successPath,
            `${config.appUrl}/dashboard?membership=success`,
            config.appUrl,
          ),
          cancelUrl: safeAppReturnPath(
            cancelPath,
            `${config.appUrl}/dashboard?membership=canceled`,
            config.appUrl,
          ),
          unitAmountCents: config.membership.priceCents,
          productName: 'Tahti ry annual membership',
          metadata: { type: 'membership', userId: user.id },
        })
        return reply.send({ checkoutUrl: session.url, sessionId: session.id })
      } catch (err) {
        request.log.error({ err }, 'membership checkout failed')
        return reply.status(502).send({ error: 'Could not start checkout' })
      }
    },
  )

  // POST /api/me/membership/portal — Stripe Customer Portal (receipts, payment method)
  fastify.post(
    '/api/me/membership/portal',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['auth'],
        response: openApiResponse(BillingPortalUrlResponseSchema, 'BillingPortalUrl'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!

      if (!user.isMember) {
        return reply.status(400).send({ error: 'Active membership required' })
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
          request.log.error({ err }, 'stripe customer creation failed')
          return reply.status(502).send({ error: 'Could not open billing portal' })
        }
      }

      try {
        const session = await createBillingPortalSession({
          customerId,
          returnUrl: `${config.appUrl}/dashboard?membership=portal`,
        })
        return reply.send({ portalUrl: session.url })
      } catch (err) {
        request.log.error({ err }, 'billing portal failed')
        return reply.status(502).send({ error: 'Could not open billing portal' })
      }
    },
  )
}

export default membershipRoutes
