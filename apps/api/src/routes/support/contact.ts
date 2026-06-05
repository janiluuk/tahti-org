// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { SupportContactResponseSchema, SupportContactSchema, openApiResponse } from '@tahti/shared'

// M21-F: public support contact form (rate-limited 3/hour per IP)
const supportContactRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/support/contact',
    {
      schema: {
        tags: ['support'],
        description: 'Submit a support request (auth optional)',
        response: openApiResponse(SupportContactResponseSchema, 'SupportContactResponse'),
      },
    },
    async (request, reply) => {
      const parsed = SupportContactSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }
      const { subject, message, category, contactEmail } = parsed.data
      const user = request.sessionUser

      if (!user && !contactEmail) {
        return reply.status(400).send({ error: 'contactEmail is required when not signed in' })
      }

      const ticket = await fastify.prisma.supportTicket.create({
        data: {
          artistId: user?.id ?? null,
          contactEmail: user ? null : contactEmail,
          subject,
          message,
          category,
        },
      })

      return reply.status(201).send({
        ok: true as const,
        ticketId: ticket.id.toString(),
      })
    },
  )
}

export default supportContactRoutes
