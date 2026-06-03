// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'
import {
  stripeEnabled,
  createConnectExpressAccount,
  createConnectAccountLink,
  fetchConnectAccount,
} from '../../lib/stripe.js'

async function syncConnectStatus(
  fastify: Parameters<FastifyPluginAsync>[0],
  userId: string,
  accountId: string,
) {
  const snapshot = await fetchConnectAccount(accountId)
  await fastify.prisma.user.update({
    where: { id: userId },
    data: { stripeConnectChargesEnabled: snapshot.chargesEnabled },
  })
  return snapshot
}

const fanConnectRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/fan-subs/connect — Connect onboarding status for the dashboard
  fastify.get('/api/me/fan-subs/connect', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!

    if (!stripeEnabled) {
      return reply.send({
        stripeConfigured: false,
        accountId: null,
        chargesEnabled: true,
        detailsSubmitted: true,
        paymentsReady: true,
      })
    }

    if (!user.stripeConnectAccountId) {
      return reply.send({
        stripeConfigured: true,
        accountId: null,
        chargesEnabled: false,
        detailsSubmitted: false,
        paymentsReady: false,
      })
    }

    try {
      const snapshot = await syncConnectStatus(fastify, user.id, user.stripeConnectAccountId)
      return reply.send({
        stripeConfigured: true,
        accountId: snapshot.id,
        chargesEnabled: snapshot.chargesEnabled,
        detailsSubmitted: snapshot.detailsSubmitted,
        paymentsReady: snapshot.chargesEnabled,
      })
    } catch (err) {
      request.log.error({ err }, 'fan-subs connect status sync failed')
      return reply.status(502).send({ error: 'Could not load Stripe Connect status' })
    }
  })

  // POST /api/me/fan-subs/connect/onboard — create/resume Express onboarding
  fastify.post(
    '/api/me/fan-subs/connect/onboard',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!

      if (!stripeEnabled) {
        return reply.status(400).send({
          error: 'Stripe is not configured — fan subscriptions activate directly in dev mode',
        })
      }

      let accountId = user.stripeConnectAccountId
      try {
        if (!accountId) {
          const account = await createConnectExpressAccount({
            email: user.email,
            userId: user.id,
          })
          accountId = account.id
          await fastify.prisma.user.update({
            where: { id: user.id },
            data: {
              stripeConnectAccountId: accountId,
              stripeConnectChargesEnabled: account.chargesEnabled,
            },
          })
        }

        const onboardingUrl = await createConnectAccountLink({
          accountId,
          refreshUrl: `${config.appUrl}/dashboard?fanConnect=refresh`,
          returnUrl: `${config.appUrl}/dashboard?fanConnect=return`,
        })

        return reply.send({ onboardingUrl, accountId })
      } catch (err) {
        request.log.error({ err }, 'fan-subs connect onboarding failed')
        return reply.status(502).send({ error: 'Could not start Stripe onboarding' })
      }
    },
  )
}

export default fanConnectRoutes
