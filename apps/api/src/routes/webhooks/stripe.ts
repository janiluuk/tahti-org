// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { constructWebhookEvent } from '../../lib/stripe.js'
import {
  activateSubscription,
  markFanSubCanceledAtPeriodEnd,
  recordFanSubPayment,
} from '../../lib/fansub.js'
import { activateMembership } from '../../lib/membership.js'
import { auditLog } from '../../lib/audit.js'
import {
  recordStripeWebhookHandlerFailure,
  recordStripeWebhookVerifyFailure,
} from '../../lib/stripe-webhook-metrics.js'

// Stripe webhook for fan-subscription lifecycle. Encapsulated in its own plugin
// so the raw-body parser (needed for signature verification) does not affect the
// rest of the API's JSON parsing.
//
// Event metadata convention (set when creating the Checkout session): the
// subscription object carries `metadata.artistUserId`, `metadata.subscriberUserId`,
// and `metadata.tierName`.
const stripeWebhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) =>
    done(null, body),
  )

  fastify.post('/api/webhooks/stripe', async (request, reply) => {
    const raw = typeof request.body === 'string' ? request.body : JSON.stringify(request.body)
    const sig = request.headers['stripe-signature'] as string | undefined

    let event
    try {
      event = constructWebhookEvent(raw, sig)
    } catch (err) {
      recordStripeWebhookVerifyFailure()
      request.log.warn({ err }, 'stripe webhook verification failed')
      return reply.status(400).send({ error: 'Invalid signature' })
    }

    const obj = event.data.object as Record<string, unknown>
    const meta = (obj.metadata as Record<string, string> | undefined) ?? {}

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          if (meta.type !== 'membership' || !meta.userId) break
          const amount = obj.amount_total != null ? Number(obj.amount_total) : undefined
          const customerId = obj.customer != null ? String(obj.customer) : undefined
          await activateMembership(fastify.prisma, meta.userId, {
            stripeSessionId: String(obj.id),
            amountCents: amount,
            stripeCustomerId: customerId,
          })
          break
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          if (!meta.artistUserId || !meta.subscriberUserId) break
          const periodEnd = obj.current_period_end
            ? new Date(Number(obj.current_period_end) * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          await activateSubscription(fastify.prisma, {
            artistUserId: meta.artistUserId,
            subscriberUserId: meta.subscriberUserId,
            tierName: meta.tierName ?? 'Supporter',
            amountCents: Number(meta.amountCents ?? obj.amount ?? 0),
            stripeSubscriptionId: String(obj.id),
            currentPeriodEnd: periodEnd,
          })
          break
        }

        case 'invoice.paid': {
          const subId = String(obj.subscription ?? '')
          const sub = await fastify.prisma.fanSubscription.findUnique({
            where: { stripeSubscriptionId: subId },
          })
          if (!sub) break
          const periodStart = obj.period_start
            ? new Date(Number(obj.period_start) * 1000)
            : new Date()
          const periodEnd = obj.period_end ? new Date(Number(obj.period_end) * 1000) : new Date()
          await recordFanSubPayment(fastify.prisma, {
            subscriptionId: sub.id,
            artistUserId: sub.artistUserId,
            grossCents: Number(obj.amount_paid ?? sub.amountCents),
            periodStart,
            periodEnd,
          })
          break
        }

        case 'customer.subscription.deleted': {
          await markFanSubCanceledAtPeriodEnd(fastify.prisma, {
            stripeSubscriptionId: String(obj.id),
          })
          break
        }

        case 'account.updated': {
          const accountId = String(obj.id ?? '')
          if (!accountId) break
          await fastify.prisma.user.updateMany({
            where: { stripeConnectAccountId: accountId },
            data: { stripeConnectChargesEnabled: obj.charges_enabled === true },
          })
          break
        }

        default:
          break
      }
    } catch (err) {
      recordStripeWebhookHandlerFailure()
      const message = err instanceof Error ? err.message : String(err)
      request.log.error({ err, type: event.type }, 'stripe webhook handler error')
      await auditLog(fastify.prisma, {
        action: 'STRIPE_WEBHOOK_ERROR',
        actorId: 'system',
        targetId: event.id ?? event.type,
        meta: {
          eventType: event.type,
          eventId: event.id,
          message,
        },
      })
      // Permanent data errors: ack so Stripe does not retry forever.
      if (message === 'User not found') {
        return reply.send({ received: true })
      }
      return reply.status(500).send({ error: 'Webhook handler failed', received: false })
    }

    return reply.send({ received: true })
  })
}

export default stripeWebhookRoutes
