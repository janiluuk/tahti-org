// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  MotionWithdrawnResponseSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireMember } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'

// What a proposer can do with their own draft. Until now only the board
// could touch a motion after it was submitted (PATCH /motions/:id), so a
// member who submitted a draft by mistake had to ask the board to deal with it.

const motionDraftRoutes: FastifyPluginAsync = async (fastify) => {
  // DELETE /api/v1/governance/motions/:id — the proposer withdraws their
  // draft. Only while DRAFT: once the board opens a motion it is part of the
  // record and stays. The audit entry keeps the title, since the row is gone.
  fastify.delete(
    '/api/v1/governance/motions/:id',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(MotionWithdrawnResponseSchema, 'MotionWithdrawn'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const motion = await fastify.prisma.motion.findUnique({
        where: { id },
        select: { title: true, state: true, proposedBy: true },
      })
      if (!motion) return reply.status(404).send({ error: 'Motion not found' })
      if (motion.proposedBy !== user.id) {
        return reply.status(403).send({ error: 'Only the proposer can withdraw a motion' })
      }
      if (motion.state !== 'DRAFT') {
        return reply.status(409).send({ error: 'Only a draft motion can be withdrawn' })
      }

      // The state is checked again in the delete, so a draft the board opens
      // at the same moment is not removed from under the vote.
      const removed = await fastify.prisma.motion.deleteMany({ where: { id, state: 'DRAFT' } })
      if (removed.count === 0) {
        return reply.status(409).send({ error: 'Only a draft motion can be withdrawn' })
      }
      await auditLog(fastify.prisma, {
        action: 'MOTION_WITHDRAW',
        actorId: user.id,
        targetId: id,
        meta: { title: motion.title },
      })
      return reply.send({ ok: true })
    },
  )
}

export default motionDraftRoutes
