// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  CreateGovernanceAgendaItemSchema,
  GovernanceAgendaItemListSchema,
  IdParamSchema,
  MemberGovernanceAgendaItemListSchema,
  PatchGovernanceAgendaItemSchema,
  ReorderGovernanceAgendaItemsSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard, requireMember } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'
import { MEETING_HELD } from '../../lib/governance-meetings.js'

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

// Once the minutes are approved the agenda is part of the record: the
// minutes refer to items by their number.
const AGENDA_LOCKED = 'The agenda is fixed once the minutes are approved'

const agendaItemRoutes: FastifyPluginAsync = async (fastify) => {
  // Members see the agenda of any meeting that has been announced (the same
  // meetings `GET /api/v1/governance/meetings` lists).
  fastify.get(
    '/api/v1/governance/meetings/:id/agenda-items',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(
          MemberGovernanceAgendaItemListSchema,
          'MemberGovernanceAgendaItemList',
        ),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const meeting = await fastify.prisma.governanceMeeting.findUnique({
        where: { id: routeParams.id },
        select: { id: true, state: true },
      })
      if (!meeting || meeting.state === 'DRAFT') {
        return reply.status(404).send({ error: 'Meeting not found' })
      }
      const items = await fastify.prisma.governanceAgendaItem.findMany({
        where: { meetingId: meeting.id },
        orderBy: { position: 'asc' },
        select: {
          ...ITEM_SELECT,
          motions: {
            where: { state: { not: 'DRAFT' } },
            orderBy: { createdAt: 'asc' },
            select: { id: true, title: true, state: true },
          },
          resolutions: {
            where: { publishedAt: { not: null } },
            orderBy: { votedAt: 'asc' },
            select: { id: true, title: true, outcome: true },
          },
          documents: {
            where: { publishedAt: { not: null }, archivedAt: null },
            orderBy: [{ type: 'asc' }, { title: 'asc' }],
            select: { id: true, title: true, type: true },
          },
        },
      })
      return reply.send(
        items.map((item) => ({
          ...item,
          resolutions: item.resolutions.map((r) => ({ ...r, id: r.id.toString() })),
        })),
      )
    },
  )

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
        select: { id: true, title: true, minutesApprovedAt: true, legalHoldAt: true },
      })
      if (!meeting) return reply.status(404).send({ error: 'Meeting not found' })
      if (meeting.minutesApprovedAt) return reply.status(409).send({ error: AGENDA_LOCKED })
      if (meeting.legalHoldAt) return reply.status(409).send({ error: MEETING_HELD })

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

      const found = await fastify.prisma.governanceAgendaItem.findUnique({
        where: { id },
        select: {
          ...ITEM_SELECT,
          meeting: { select: { minutesApprovedAt: true, legalHoldAt: true } },
        },
      })
      if (!found) return reply.status(404).send({ error: 'Agenda item not found' })
      const { meeting, ...existing } = found
      if (meeting.minutesApprovedAt) return reply.status(409).send({ error: AGENDA_LOCKED })
      if (meeting.legalHoldAt) return reply.status(409).send({ error: MEETING_HELD })
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
  fastify.put(
    '/api/admin/governance/meetings/:id/agenda-items/order',
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
      const parsed = ReorderGovernanceAgendaItemsSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      const { ids } = parsed.data

      const meeting = await fastify.prisma.governanceMeeting.findUnique({
        where: { id: routeParams.id },
        select: { id: true, minutesApprovedAt: true, legalHoldAt: true },
      })
      if (!meeting) return reply.status(404).send({ error: 'Meeting not found' })
      if (meeting.minutesApprovedAt) return reply.status(409).send({ error: AGENDA_LOCKED })
      if (meeting.legalHoldAt) return reply.status(409).send({ error: MEETING_HELD })

      const result = await fastify.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "governance"."GovernanceMeeting" WHERE id = ${meeting.id} FOR UPDATE`
        const items = await tx.governanceAgendaItem.findMany({
          where: { meetingId: meeting.id },
          orderBy: { position: 'asc' },
          select: { id: true },
        })
        const current = items.map((item) => item.id)
        if (current.length !== ids.length || !ids.every((id) => current.includes(id))) {
          return null
        }
        const moved = ids.some((id, index) => current[index] !== id)
        if (moved) {
          for (const [index, id] of ids.entries()) {
            await tx.governanceAgendaItem.update({ where: { id }, data: { position: index + 1 } })
          }
        }
        return { moved, previous: current }
      })
      if (!result) {
        return reply
          .status(400)
          .send({ error: "List every item of this meeting's agenda exactly once" })
      }
      if (result.moved) {
        await auditLog(fastify.prisma, {
          action: 'AGENDA_ITEM_REORDER',
          actorId: request.sessionUser!.id,
          targetId: meeting.id,
          meta: { order: ids, previousOrder: result.previous },
        })
      }
      return reply.send(
        await fastify.prisma.governanceAgendaItem.findMany({
          where: { meetingId: meeting.id },
          orderBy: { position: 'asc' },
          select: ITEM_SELECT,
        }),
      )
    },
  )

  fastify.delete(
    '/api/admin/governance/agenda-items/:id',
    {
      preHandler: requireBoard,
      schema: { tags: ['admin'] },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const item = await fastify.prisma.governanceAgendaItem.findUnique({
        where: { id },
        select: {
          ...ITEM_SELECT,
          meeting: { select: { minutesApprovedAt: true, legalHoldAt: true } },
          _count: { select: { motions: true, resolutions: true, documents: true } },
        },
      })
      if (!item) return reply.status(404).send({ error: 'Agenda item not found' })
      if (item.meeting.minutesApprovedAt) return reply.status(409).send({ error: AGENDA_LOCKED })
      if (item.meeting.legalHoldAt) return reply.status(409).send({ error: MEETING_HELD })
      if (item._count.motions + item._count.resolutions + item._count.documents > 0) {
        return reply
          .status(409)
          .send({ error: 'Records still point at this agenda item: unlink them first' })
      }

      // The items after it move up one place, so the numbering stays 1..n.
      await fastify.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "governance"."GovernanceMeeting" WHERE id = ${item.meetingId} FOR UPDATE`
        await tx.governanceAgendaItem.delete({ where: { id } })
        await tx.governanceAgendaItem.updateMany({
          where: { meetingId: item.meetingId, position: { gt: item.position } },
          data: { position: { decrement: 1 } },
        })
      })
      await auditLog(fastify.prisma, {
        action: 'AGENDA_ITEM_REMOVE',
        actorId: request.sessionUser!.id,
        targetId: id,
        meta: { meetingId: item.meetingId, position: item.position, title: item.title },
      })
      return reply.status(204).send()
    },
  )
}

export default agendaItemRoutes
