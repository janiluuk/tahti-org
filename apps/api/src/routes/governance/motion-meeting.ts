// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  LinkMotionAgendaItemSchema,
  LinkMotionMeetingSchema,
  MotionMeetingLinkResponseSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'

// Linking a motion to the meeting that takes it up. Resolutions and
// documents already point at a meeting; an advisory motion did not, so the
// record could not say which meeting discussed it. An agenda item narrows
// that to the point of the agenda; it always belongs to the linked meeting.

const AGENDA_ITEM_SELECT = { id: true, position: true, title: true } as const

const motionMeetingRoutes: FastifyPluginAsync = async (fastify) => {
  // PUT /api/v1/governance/motions/:id/meeting — board sets or clears the
  // link, in any motion state (a motion is often put on an agenda after its
  // vote has closed).
  fastify.put(
    '/api/v1/governance/motions/:id/meeting',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['governance'],
        response: openApiResponse(MotionMeetingLinkResponseSchema, 'MotionMeetingLink'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const parsed = LinkMotionMeetingSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const { meetingId } = parsed.data

      const motion = await fastify.prisma.motion.findUnique({
        where: { id },
        select: {
          meetingId: true,
          agendaItemId: true,
          agendaItem: { select: AGENDA_ITEM_SELECT },
        },
      })
      if (!motion) return reply.status(404).send({ error: 'Motion not found' })

      const meeting = meetingId
        ? await fastify.prisma.governanceMeeting.findUnique({
            where: { id: meetingId },
            select: { id: true, title: true, scheduledAt: true },
          })
        : null
      if (meetingId && !meeting) return reply.status(400).send({ error: 'Meeting not found' })

      if (motion.meetingId !== meetingId) {
        // An agenda item of the previous meeting no longer applies.
        await fastify.prisma.motion.update({
          where: { id },
          data: { meetingId, agendaItemId: null },
        })
        await auditLog(fastify.prisma, {
          action: 'MOTION_MEETING_LINK',
          actorId: user.id,
          targetId: id,
          meta: {
            meetingId,
            previousMeetingId: motion.meetingId,
            ...(motion.agendaItemId ? { previousAgendaItemId: motion.agendaItemId } : {}),
          },
        })
        return reply.send({ id, meeting, agendaItem: null })
      }
      return reply.send({ id, meeting, agendaItem: motion.agendaItem })
    },
  )

  // PUT /api/v1/governance/motions/:id/agenda-item — board names the agenda
  // item (and with it the meeting) that takes the motion up, or clears it.
  fastify.put(
    '/api/v1/governance/motions/:id/agenda-item',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['governance'],
        response: openApiResponse(MotionMeetingLinkResponseSchema, 'MotionMeetingLink'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const parsed = LinkMotionAgendaItemSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const { agendaItemId } = parsed.data

      const motion = await fastify.prisma.motion.findUnique({
        where: { id },
        select: { meetingId: true, agendaItemId: true },
      })
      if (!motion) return reply.status(404).send({ error: 'Motion not found' })

      const item = agendaItemId
        ? await fastify.prisma.governanceAgendaItem.findUnique({
            where: { id: agendaItemId },
            select: { ...AGENDA_ITEM_SELECT, meetingId: true },
          })
        : null
      if (agendaItemId && !item) return reply.status(400).send({ error: 'Agenda item not found' })
      const meetingId = item ? item.meetingId : motion.meetingId

      if (motion.agendaItemId !== agendaItemId) {
        await fastify.prisma.motion.update({ where: { id }, data: { agendaItemId, meetingId } })
        await auditLog(fastify.prisma, {
          action: 'MOTION_AGENDA_LINK',
          actorId: user.id,
          targetId: id,
          meta: {
            agendaItemId,
            previousAgendaItemId: motion.agendaItemId,
            meetingId,
            ...(item ? { position: item.position, title: item.title } : {}),
          },
        })
      }
      const meeting = meetingId
        ? await fastify.prisma.governanceMeeting.findUnique({
            where: { id: meetingId },
            select: { id: true, title: true, scheduledAt: true },
          })
        : null
      return reply.send({
        id,
        meeting,
        agendaItem: item ? { id: item.id, position: item.position, title: item.title } : null,
      })
    },
  )
}

export default motionMeetingRoutes
