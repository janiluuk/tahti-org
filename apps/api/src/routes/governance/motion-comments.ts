// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import {
  MotionCommentRemovedResponseSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireMember } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'

const CommentParamsSchema = z.object({
  id: z.string().min(1).max(64),
  commentId: z.string().regex(/^\d{1,18}$/),
})

// Removing a comment from a motion's discussion. A comment could be posted
// but never taken back, so a member who posted to the wrong motion (or said
// something they should not have) had no way to fix it.

const motionCommentRoutes: FastifyPluginAsync = async (fastify) => {
  // DELETE /api/v1/governance/motions/:id/comments/:commentId — the author
  // removes their own comment. Only while the motion is not CLOSED: a closed
  // motion's discussion is the record of how the decision was reached.
  fastify.delete(
    '/api/v1/governance/motions/:id/comments/:commentId',
    {
      preHandler: requireMember,
      schema: {
        tags: ['governance'],
        response: openApiResponse(MotionCommentRemovedResponseSchema, 'MotionCommentRemoved'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(CommentParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const commentId = BigInt(routeParams.commentId)

      const comment = await fastify.prisma.motionComment.findFirst({
        where: { id: commentId, motionId: id },
        select: { authorId: true, removedAt: true, motion: { select: { state: true } } },
      })
      if (!comment) return reply.status(404).send({ error: 'Comment not found' })
      if (comment.authorId !== user.id) {
        return reply.status(403).send({ error: 'You can only remove your own comment' })
      }
      if (comment.motion.state === 'CLOSED') {
        return reply.status(409).send({ error: 'This motion is closed; its discussion is kept' })
      }
      if (comment.removedAt) return reply.send({ ok: true })

      await fastify.prisma.motionComment.update({
        where: { id: commentId },
        data: { removedAt: new Date(), removedById: user.id },
      })
      await auditLog(fastify.prisma, {
        action: 'MOTION_COMMENT_REMOVE',
        actorId: user.id,
        targetId: id,
        meta: { commentId: routeParams.commentId, byAuthor: true },
      })
      return reply.send({ ok: true })
    },
  )
}

export default motionCommentRoutes
