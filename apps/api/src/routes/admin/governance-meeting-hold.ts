// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  GovernanceMeetingLegalHoldSchema,
  GovernanceMeetingListSchema,
  IdParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'
import { meetingResponse } from '../../lib/governance-meetings.js'

// A legal hold keeps a meeting record exactly as it is while a dispute, an
// audit or an authority's request is pending: its details, minutes,
// attendance, conflict declarations and agenda cannot change until the board
// lifts the hold.

const governanceMeetingHoldRoutes: FastifyPluginAsync = async (fastify) => {
  async function respond(id: string) {
    const meeting = await fastify.prisma.governanceMeeting.findUniqueOrThrow({
      where: { id },
      include: { attendance: { select: { status: true } } },
    })
    return meetingResponse(meeting)
  }

  fastify.put(
    '/api/admin/governance/meetings/:id/legal-hold',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(GovernanceMeetingListSchema.element, 'GovernanceMeeting'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const parsed = GovernanceMeetingLegalHoldSchema.safeParse(request.body)
      if (!parsed.success)
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })

      const existing = await fastify.prisma.governanceMeeting.findUnique({
        where: { id },
        select: { title: true, legalHoldAt: true, legalHoldReason: true },
      })
      if (!existing) return reply.status(404).send({ error: 'Meeting not found' })
      if (existing.legalHoldReason !== parsed.data.reason) {
        await fastify.prisma.governanceMeeting.update({
          where: { id },
          data: {
            legalHoldAt: existing.legalHoldAt ?? new Date(),
            legalHoldReason: parsed.data.reason,
          },
        })
        await auditLog(fastify.prisma, {
          action: 'MEETING_LEGAL_HOLD',
          actorId: request.sessionUser!.id,
          targetId: id,
          meta: { title: existing.title, held: true, reason: parsed.data.reason },
        })
      }
      return reply.send(await respond(id))
    },
  )

  fastify.delete(
    '/api/admin/governance/meetings/:id/legal-hold',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(GovernanceMeetingListSchema.element, 'GovernanceMeeting'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const existing = await fastify.prisma.governanceMeeting.findUnique({
        where: { id },
        select: { title: true, legalHoldAt: true },
      })
      if (!existing) return reply.status(404).send({ error: 'Meeting not found' })
      if (existing.legalHoldAt) {
        await fastify.prisma.governanceMeeting.update({
          where: { id },
          data: { legalHoldAt: null, legalHoldReason: null },
        })
        await auditLog(fastify.prisma, {
          action: 'MEETING_LEGAL_HOLD',
          actorId: request.sessionUser!.id,
          targetId: id,
          meta: { title: existing.title, held: false },
        })
      }
      return reply.send(await respond(id))
    },
  )
}

export default governanceMeetingHoldRoutes
