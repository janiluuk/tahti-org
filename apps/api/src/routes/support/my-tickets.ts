// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  MySupportTicketListSchema,
  MySupportTicketReplyBodySchema,
  MySupportTicketReplySchema,
  SUPPORT_REPLY_AUTHOR_NAME,
  TicketIdParamSchema,
  openApiResponses,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const MY_TICKETS_LIMIT = 50
const OWN_REPLY_AUTHOR_NAME = 'You'

function mapReply(
  note: { id: bigint; body: string; createdAt: Date; authorId: string | null },
  requesterId: string,
) {
  const fromRequester = note.authorId === requesterId
  return {
    id: note.id.toString(),
    body: note.body,
    authorName: fromRequester ? OWN_REPLY_AUTHOR_NAME : SUPPORT_REPLY_AUTHOR_NAME,
    fromRequester,
    createdAt: note.createdAt,
  }
}

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
            select: { id: true, body: true, createdAt: true, authorId: true },
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
          replies: t.notes.map((n) => mapReply(n, user.id)),
        })),
      })
    },
  )

  // POST /api/me/support/tickets/:id/replies { body } — the requester answers
  // the board on their own ticket. A resolved ticket goes back to OPEN so the
  // board sees it again.
  fastify.post(
    '/api/me/support/tickets/:id/replies',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['support'],
        description: "Add a follow-up to one of the signed-in user's support requests",
        response: openApiResponses([
          { status: 201, schema: MySupportTicketReplySchema, name: 'MySupportTicketReply' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(TicketIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = MySupportTicketReplyBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' })
      }

      const ticket = await fastify.prisma.supportTicket.findFirst({
        where: { id: routeParams.id, artistId: user.id },
        select: { id: true, status: true },
      })
      if (!ticket) return reply.status(404).send({ error: 'Request not found' })

      const note = await fastify.prisma.$transaction(async (tx) => {
        const created = await tx.supportTicketNote.create({
          data: { ticketId: ticket.id, body: parsed.data.body, authorId: user.id },
          select: { id: true, body: true, createdAt: true, authorId: true },
        })
        if (ticket.status === 'RESOLVED') {
          await tx.supportTicketNote.create({
            data: {
              ticketId: ticket.id,
              kind: 'STATUS_CHANGE',
              body: 'Status changed from RESOLVED to OPEN (the requester replied)',
              authorId: user.id,
            },
          })
        }
        await tx.supportTicket.update({
          where: { id: ticket.id },
          data: ticket.status === 'RESOLVED' ? { status: 'OPEN' } : { updatedAt: new Date() },
        })
        return created
      })

      return reply.status(201).send(mapReply(note, user.id))
    },
  )
}

export default mySupportTicketsRoutes
