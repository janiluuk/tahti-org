// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  CreateGovernanceAgendaItemSchema,
  GovernanceAgendaItemListSchema,
  IdParamSchema,
  PatchGovernanceAgendaItemSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'

// A meeting's agenda as separate items. The meeting's `agenda` JSON is the
// free-form notice text and stays as it is; an item here is something a
// motion, resolution or document can point at.

const ITEM_SELECT = {
  id: true,
  meetingId: true,
  position: true,
  title: true,
  description: true,
} as const

const agendaItemRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/governance/meetings/:id/agenda-items',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(GovernanceAgendaItemListSchema, 'GovernanceAgendaItemList'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const meeting = await fastify.prisma.governanceMeeting.findUnique({
        where: { id: routeParams.id },
        select: { id: true },
      })
      if (!meeting) return reply.status(404).send({ error: 'Meeting not found' })
      return reply.send(
        await fastify.prisma.governanceAgendaItem.findMany({
          where: { meetingId: meeting.id },
          orderBy: { position: 'asc' },
          select: ITEM_SELECT,
        }),
      )
    },
  )

  fastify.post(
    '/api/admin/governance/meetings/:id/agenda-items',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponses([
          {
            status: 201,
            schema: GovernanceAgendaItemListSchema.element,
            name: 'GovernanceAgendaItem',
          },
        ]),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = CreateGovernanceAgendaItemSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })

      const meeting = await fastify.prisma.governanceMeeting.findUnique({
        where: { id: routeParams.id },
        select: { id: true, title: true },
      })
      if (!meeting) return reply.status(404).send({ error: 'Meeting not found' })

      // The meeting row is locked so two items added at once get distinct positions.
      const item = await fastify.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "governance"."GovernanceMeeting" WHERE id = ${meeting.id} FOR UPDATE`
        const last = await tx.governanceAgendaItem.aggregate({
          where: { meetingId: meeting.id },
          _max: { position: true },
        })
        return tx.governanceAgendaItem.create({
          data: {
            meetingId: meeting.id,
            position: (last._max.position ?? 0) + 1,
            title: parsed.data.title,
            description: parsed.data.description,
            createdById: request.sessionUser!.id,
          },
          select: ITEM_SELECT,
        })
      })
      await auditLog(fastify.prisma, {
        action: 'AGENDA_ITEM_CREATE',
        actorId: request.sessionUser!.id,
        targetId: item.id,
        meta: {
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          position: item.position,
          title: item.title,
        },
      })
      return reply.status(201).send(item)
    },
  )

  fastify.patch(
    '/api/admin/governance/agenda-items/:id',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(GovernanceAgendaItemListSchema.element, 'GovernanceAgendaItem'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const parsed = PatchGovernanceAgendaItemSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })

      const existing = await fastify.prisma.governanceAgendaItem.findUnique({
        where: { id },
        select: ITEM_SELECT,
      })
      if (!existing) return reply.status(404).send({ error: 'Agenda item not found' })
      const changed = (Object.keys(parsed.data) as Array<keyof typeof parsed.data>).filter(
        (key) => parsed.data[key] !== existing[key],
      )
      if (changed.length === 0) return reply.send(existing)

      const item = await fastify.prisma.governanceAgendaItem.update({
        where: { id },
        data: parsed.data,
        select: ITEM_SELECT,
      })
      await auditLog(fastify.prisma, {
        action: 'AGENDA_ITEM_UPDATE',
        actorId: request.sessionUser!.id,
        targetId: id,
        meta: { meetingId: item.meetingId, title: item.title, changed },
      })
      return reply.send(item)
    },
  )
}

export default agendaItemRoutes
