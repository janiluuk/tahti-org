// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  parseEmailBouncePayload,
  recordNewsletterBounce,
  shouldUnsubscribeForBounce,
} from '../../lib/newsletter-bounce.js'
import { recordGovernanceNoticeBounce } from '../../lib/governance-notice.js'

function webhookAuthorized(request: { headers: Record<string, unknown> }): boolean {
  const secret = process.env.EMAIL_BOUNCE_WEBHOOK_SECRET?.trim() ?? ''
  if (!secret) return process.env.NODE_ENV !== 'production'

  const header =
    (request.headers['x-tahti-webhook-secret'] as string | undefined) ??
    (request.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '')

  return header === secret
}

const emailBounceWebhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/webhooks/email/bounce', async (request, reply) => {
    if (!webhookAuthorized(request)) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const parsed = parseEmailBouncePayload(request.body)
    if (!parsed) {
      return reply.status(400).send({ error: 'Unrecognized bounce payload' })
    }

    if ('subscribeUrl' in parsed) {
      try {
        const res = await fetch(parsed.subscribeUrl, { method: 'GET' })
        request.log.info({ status: res.status }, 'sns subscription confirmed')
      } catch (err) {
        request.log.warn({ err }, 'sns subscription confirm failed')
        return reply.status(502).send({ error: 'SNS confirm failed' })
      }
      return reply.send({ ok: true, action: 'sns_subscribed' })
    }

    // Any bounce is real evidence a governance notice may not have landed —
    // unlike the newsletter unsubscribe policy below, this isn't gated on
    // hard-vs-soft: record it regardless of what happens next.
    const governanceResult = await recordGovernanceNoticeBounce(fastify.prisma, parsed.email)

    if (!shouldUnsubscribeForBounce(parsed.kind)) {
      request.log.info(
        { email: parsed.email, kind: parsed.kind, ...governanceResult },
        'soft bounce ignored (newsletter); governance notice deliveries updated',
      )
      return reply.send({ ok: true, action: 'ignored', kind: parsed.kind, ...governanceResult })
    }

    const result = await recordNewsletterBounce(fastify.prisma, parsed.email)
    request.log.info(
      { email: parsed.email, kind: parsed.kind, ...result, ...governanceResult },
      'newsletter bounce processed',
    )

    return reply.send({ ok: true, action: 'unsubscribed', ...result, ...governanceResult })
  })
}

export default emailBounceWebhookRoutes
