// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@tahti/db'
import {
  AdminSupportTicketCreateSchema,
  AdminSupportTicketDetailSchema,
  AdminSupportTicketListQuerySchema,
  AdminSupportTicketListSchema,
  AdminSupportTicketNoteBodySchema,
  AdminSupportTicketPatchSchema,
  TicketIdParamSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'

function mapTicketRow(ticket: {
  id: bigint
  subject: string
  category: string
  status: string
  artistId: string | null
  contactEmail: string | null
  assignedToId: string | null
  createdAt: Date
  updatedAt: Date
  artist: { username: string; displayName: string } | null
}) {
  return {
    id: ticket.id.toString(),
    subject: ticket.subject,
    category: ticket.category,
    status: ticket.status,
    artistId: ticket.artistId,
    artistUsername: ticket.artist?.username ?? null,
    artistDisplayName: ticket.artist?.displayName ?? null,
    contactEmail: ticket.contactEmail,
    assignedToId: ticket.assignedToId,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  }
}

const adminSupportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/support/tickets',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminSupportTicketListSchema, 'AdminSupportTicketList'),
      },
    },
    async (request, reply) => {
      const parsed = AdminSupportTicketListQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid query',
        })
      }
      const { page, limit, status, category } = parsed.data
      const where: Prisma.SupportTicketWhereInput = {}
      if (status) where.status = status
      if (category) where.category = category

      const [total, rows] = await Promise.all([
        fastify.prisma.supportTicket.count({ where }),
        fastify.prisma.supportTicket.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            artist: { select: { username: true, displayName: true } },
          },
        }),
      ])

      return reply.send({
        page,
        limit,
        total,
        tickets: rows.map(mapTicketRow),
      })
    },
  )

  fastify.post(
    '/api/admin/support/tickets',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponses([
          { status: 201, schema: AdminSupportTicketDetailSchema, name: 'AdminSupportTicketDetail' },
        ]),
      },
    },
    async (request, reply) => {
      const parsed = AdminSupportTicketCreateSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }
      const body = parsed.data

      const ticket = await fastify.prisma.supportTicket.create({
        data: {
          artistId: body.artistId ?? null,
          contactEmail: body.contactEmail ?? null,
          subject: body.subject,
          message: body.message,
          category: body.category,
        },
        include: {
          artist: { select: { username: true, displayName: true } },
          notes: {
            orderBy: { createdAt: 'asc' },
            include: { author: { select: { displayName: true } } },
          },
        },
      })

      return reply.status(201).send({
        ...mapTicketRow(ticket),
        message: ticket.message,
        notes: ticket.notes.map((n) => ({
          id: n.id.toString(),
          body: n.body,
          authorId: n.authorId,
          authorDisplayName: n.author?.displayName ?? null,
          createdAt: n.createdAt,
        })),
      })
    },
  )

  fastify.get(
    '/api/admin/support/tickets/:id',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminSupportTicketDetailSchema, 'AdminSupportTicketDetail'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(TicketIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const ticket = await fastify.prisma.supportTicket.findUnique({
        where: { id },
        include: {
          artist: { select: { username: true, displayName: true } },
          notes: {
            orderBy: { createdAt: 'asc' },
            include: { author: { select: { displayName: true } } },
          },
        },
      })
      if (!ticket) return reply.status(404).send({ error: 'Ticket not found' })

      return reply.send({
        ...mapTicketRow(ticket),
        message: ticket.message,
        notes: ticket.notes.map((n) => ({
          id: n.id.toString(),
          body: n.body,
          authorId: n.authorId,
          authorDisplayName: n.author?.displayName ?? null,
          createdAt: n.createdAt,
        })),
      })
    },
  )

  fastify.patch(
    '/api/admin/support/tickets/:id',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminSupportTicketDetailSchema, 'AdminSupportTicketDetail'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(TicketIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const parsed = AdminSupportTicketPatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }

      const existing = await fastify.prisma.supportTicket.findUnique({ where: { id } })
      if (!existing) return reply.status(404).send({ error: 'Ticket not found' })

      const ticket = await fastify.prisma.supportTicket.update({
        where: { id },
        data: parsed.data,
        include: {
          artist: { select: { username: true, displayName: true } },
          notes: {
            orderBy: { createdAt: 'asc' },
            include: { author: { select: { displayName: true } } },
          },
        },
      })

      return reply.send({
        ...mapTicketRow(ticket),
        message: ticket.message,
        notes: ticket.notes.map((n) => ({
          id: n.id.toString(),
          body: n.body,
          authorId: n.authorId,
          authorDisplayName: n.author?.displayName ?? null,
          createdAt: n.createdAt,
        })),
      })
    },
  )

  fastify.post(
    '/api/admin/support/tickets/:id/notes',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminSupportTicketDetailSchema, 'AdminSupportTicketDetail'),
      },
    },
    async (request, reply) => {
      const actor = request.sessionUser!
      const routeParams = parseRouteParams(TicketIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const parsed = AdminSupportTicketNoteBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }

      const existing = await fastify.prisma.supportTicket.findUnique({ where: { id } })
      if (!existing) return reply.status(404).send({ error: 'Ticket not found' })

      await fastify.prisma.supportTicketNote.create({
        data: {
          ticketId: id,
          body: parsed.data.body,
          authorId: actor.id,
        },
      })

      const ticket = await fastify.prisma.supportTicket.findUnique({
        where: { id },
        include: {
          artist: { select: { username: true, displayName: true } },
          notes: {
            orderBy: { createdAt: 'asc' },
            include: { author: { select: { displayName: true } } },
          },
        },
      })

      return reply.send({
        ...mapTicketRow(ticket!),
        message: ticket!.message,
        notes: ticket!.notes.map((n) => ({
          id: n.id.toString(),
          body: n.body,
          authorId: n.authorId,
          authorDisplayName: n.author?.displayName ?? null,
          createdAt: n.createdAt,
        })),
      })
    },
  )
}

export default adminSupportRoutes
