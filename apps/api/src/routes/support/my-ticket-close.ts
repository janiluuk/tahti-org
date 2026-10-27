// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  MySupportTicketCloseResponseSchema,
  TicketIdParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

// The requester could reply on their own support request but never say
// "sorted, thanks": it stayed open on the board's queue until someone there
// closed it.
const mySupportTicketCloseRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/me/support/tickets/:id/close — the requester marks their own
  // request resolved. Replying again reopens it, as for a board resolve.
  fastify.post(
    '/api/me/support/tickets/:id/close',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['support'],
        description: 'Mark one of your own support requests resolved',
        response: openApiResponse(MySupportTicketCloseResponseSchema, 'MySupportTicketClose'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(TicketIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const ticket = await fastify.prisma.supportTicket.findFirst({
        where: { id: routeParams.id, artistId: user.id },
        select: { id: true, status: true },
      })
      if (!ticket) return reply.status(404).send({ error: 'Request not found' })
      if (ticket.status === 'RESOLVED') return reply.send({ status: 'RESOLVED' as const })

      await fastify.prisma.$transaction([
        fastify.prisma.supportTicketNote.create({
          data: {
            ticketId: ticket.id,
            kind: 'STATUS_CHANGE',
            body: `Status changed from ${ticket.status} to RESOLVED (closed by the requester)`,
            authorId: user.id,
          },
        }),
        fastify.prisma.supportTicket.update({
          where: { id: ticket.id },
          data: { status: 'RESOLVED' },
        }),
      ])
      return reply.send({ status: 'RESOLVED' as const })
    },
  )
}

export default mySupportTicketCloseRoutes
