// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  MotionSecondResponseSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireMember } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'

// Seconding a motion draft. A member-submitted draft sat in the list with no
// way for other members to show the board it has support; the board decided
// what to open with nothing but the discussion thread to go on. A second is
// a member's public "put this to a vote". It is taken only while the motion
// is a DRAFT, and never from the proposer.

const motionSecondsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/v1/governance/motions/:id/second',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponses([
          { status: 200, schema: MotionSecondResponseSchema, name: 'MotionAlreadySeconded' },
          { status: 201, schema: MotionSecondResponseSchema, name: 'MotionSeconded' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const motion = await fastify.prisma.motion.findUnique({
        where: { id },
        select: { state: true, proposedBy: true },
      })
      if (!motion) return reply.status(404).send({ error: 'Motion not found' })
      if (motion.state !== 'DRAFT') {
        return reply.status(409).send({ error: 'Only a draft motion can be seconded' })
      }
      if (motion.proposedBy === user.id) {
        return reply.status(409).send({ error: 'You cannot second your own motion' })
      }

      const key = { motionId_userId: { motionId: id, userId: user.id } }
      const existing = await fastify.prisma.motionSecond.findUnique({ where: key })
      if (!existing) {
        await fastify.prisma.motionSecond.create({ data: { motionId: id, userId: user.id } })
        await auditLog(fastify.prisma, {
          action: 'MOTION_SECOND',
          actorId: user.id,
          targetId: id,
        })
      }
      const secondCount = await fastify.prisma.motionSecond.count({ where: { motionId: id } })
      return reply.status(existing ? 200 : 201).send({ ok: true, secondCount })
    },
  )

  fastify.delete(
    '/api/v1/governance/motions/:id/second',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(MotionSecondResponseSchema, 'MotionSecondWithdrawn'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const motion = await fastify.prisma.motion.findUnique({
        where: { id },
        select: { state: true },
      })
      if (!motion) return reply.status(404).send({ error: 'Motion not found' })
      if (motion.state !== 'DRAFT') {
        return reply
          .status(409)
          .send({ error: 'A second can only be withdrawn while the motion is a draft' })
      }

      const removed = await fastify.prisma.motionSecond.deleteMany({
        where: { motionId: id, userId: user.id },
      })
      if (removed.count === 0) {
        return reply.status(404).send({ error: 'You have not seconded this motion' })
      }
      await auditLog(fastify.prisma, {
        action: 'MOTION_SECOND_WITHDRAW',
        actorId: user.id,
        targetId: id,
      })
      const secondCount = await fastify.prisma.motionSecond.count({ where: { motionId: id } })
      return reply.send({ ok: true, secondCount })
    },
  )
}

export default motionSecondsRoutes
