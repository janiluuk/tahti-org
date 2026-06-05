// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { BetaApplyResponseSchema, BetaApplySchema, openApiResponse } from '@tahti/shared'
import { sendBetaApplicationEmail } from '../../lib/email.js'
import { applyPublicFormCors } from '../../lib/public-cors.js'

/** Public beta application form — emails support@tahti.live and opens admin ticket. */
const betaApplyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.options('/api/beta/apply', async (request, reply) => {
    applyPublicFormCors(request, reply)
    reply.header('Access-Control-Allow-Methods', 'POST, OPTIONS')
    reply.header('Access-Control-Allow-Headers', 'Content-Type')
    return reply.status(204).send()
  })

  fastify.post(
    '/api/beta/apply',
    {
      schema: {
        tags: ['support'],
        description: 'Submit a private beta application (public, rate-limited)',
        response: openApiResponse(BetaApplyResponseSchema, 'BetaApplyResponse'),
      },
    },
    async (request, reply) => {
      applyPublicFormCors(request, reply)

      const parsed = BetaApplySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }

      const data = parsed.data
      const origin = request.headers.origin ?? ''
      const source: 'website' | 'app' =
        origin.includes('app.tahti.live') ||
        origin.startsWith('http://localhost:3000') ||
        origin.startsWith('http://127.0.0.1:3000')
          ? 'app'
          : 'website'

      const messageParts = [data.message?.trim()].filter(Boolean)
      if (data.links?.trim()) {
        messageParts.unshift(`Music links: ${data.links.trim()}`)
      }
      const ticketMessage = messageParts.join('\n\n') || '(No additional message)'

      let ticketId: string | undefined
      try {
        const ticket = await fastify.prisma.supportTicket.create({
          data: {
            contactEmail: data.email,
            subject: `Beta application: ${data.name}`,
            message: [
              `Artist type: ${data.artistType}`,
              data.links?.trim() ? `Links: ${data.links.trim()}` : null,
              '',
              ticketMessage,
            ]
              .filter((line) => line !== null)
              .join('\n'),
            category: 'OTHER',
          },
        })
        ticketId = ticket.id.toString()
      } catch (err) {
        fastify.log.error({ err }, 'beta apply ticket create failed')
      }

      try {
        await sendBetaApplicationEmail({ ...data, source })
      } catch (err) {
        fastify.log.error({ err }, 'beta apply email failed')
        return reply.status(503).send({ error: 'Could not send application — try again later' })
      }

      return reply.status(201).send({ ok: true as const, ticketId })
    },
  )
}

export default betaApplyRoutes
