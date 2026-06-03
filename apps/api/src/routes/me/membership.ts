// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'
import { stripeEnabled, createCheckoutSession } from '../../lib/stripe.js'
import { activateMembership } from '../../lib/membership.js'

const membershipRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/membership — current membership status
  fastify.get('/api/me/membership', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const membership = await fastify.prisma.membership.findUnique({
      where: { userId: user.id },
    })
    return reply.send({
      status: membership?.status ?? 'PENDING_EMAIL',
      isMember: user.isMember,
      memberNumber: user.memberNumber,
      memberSince: user.memberSince,
      tier: user.tier,
      priceCents: config.membership.priceCents,
      emailVerified: !!user.emailVerifiedAt,
    })
  })

  // POST /api/me/membership/checkout — pay €40 annual membership
  fastify.post(
    '/api/me/membership/checkout',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!

      if (!user.emailVerifiedAt) {
        return reply.status(400).send({ error: 'Verify your email before paying for membership' })
      }

      if (user.isMember) {
        return reply.status(409).send({ error: 'You are already a member' })
      }

      const membership = await fastify.prisma.membership.findUnique({
        where: { userId: user.id },
      })
      if (membership?.status === 'PENDING_EMAIL') {
        return reply.status(400).send({ error: 'Verify your email first' })
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
        const session = await createCheckoutSession({
          customerEmail: user.email,
          successUrl: `${config.appUrl}/dashboard?membership=success`,
          cancelUrl: `${config.appUrl}/dashboard?membership=canceled`,
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
}

export default membershipRoutes
