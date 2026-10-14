// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  LinkMotionMeetingSchema,
  MotionMeetingLinkResponseSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'

// Linking a motion to the meeting that takes it up. Resolutions and
// documents already point at a meeting; an advisory motion did not, so the
// record could not say which meeting discussed it.

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
        select: { meetingId: true },
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
        await fastify.prisma.motion.update({ where: { id }, data: { meetingId } })
        await auditLog(fastify.prisma, {
          action: 'MOTION_MEETING_LINK',
          actorId: user.id,
          targetId: id,
          meta: { meetingId, previousMeetingId: motion.meetingId },
        })
      }
      return reply.send({ id, meeting })
    },
  )
}

export default motionMeetingRoutes
