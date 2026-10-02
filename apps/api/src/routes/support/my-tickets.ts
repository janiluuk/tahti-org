// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  MySupportTicketListSchema,
  SUPPORT_REPLY_AUTHOR_NAME,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const MY_TICKETS_LIMIT = 50

const mySupportTicketsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/support/tickets',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['support'],
        description: "The signed-in user's support requests and the board's replies",
        response: openApiResponse(MySupportTicketListSchema, 'MySupportTicketList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!

      // Matched by user id only: tickets filed while signed out carry just a
      // contactEmail, and an unverified address must not unlock someone's thread.
      const tickets = await fastify.prisma.supportTicket.findMany({
        where: { artistId: user.id },
        orderBy: { createdAt: 'desc' },
        take: MY_TICKETS_LIMIT,
        include: {
          // STATUS_CHANGE rows are the board's audit trail; the requester sees
          // the current status instead.
          notes: {
            where: { kind: 'MESSAGE' },
            orderBy: { createdAt: 'asc' },
            select: { id: true, body: true, createdAt: true },
          },
        },
      })

      return reply.send({
        tickets: tickets.map((t) => ({
          id: t.id.toString(),
          subject: t.subject,
          message: t.message,
          category: t.category,
          status: t.status,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          replies: t.notes.map((n) => ({
            id: n.id.toString(),
            body: n.body,
            authorName: SUPPORT_REPLY_AUTHOR_NAME,
            createdAt: n.createdAt,
          })),
        })),
      })
    },
  )
}

export default mySupportTicketsRoutes
