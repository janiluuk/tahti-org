// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { AuthMessageResponseSchema, ChangePasswordSchema, openApiResponse } from '@tahti/shared'
import { requireSession } from '../../plugins/auth.js'
import { hashPassword, verifyPassword } from '../../lib/password.js'
import { revokeOtherSessions } from '../../lib/session.js'

const mePasswordRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/me/password — change the password while signed in. Needs the
  // current password; every other session is signed out so old credentials
  // stop working everywhere but here. Not available to API tokens.
  fastify.post(
    '/api/me/password',
    {
      preHandler: requireSession,
      schema: {
        tags: ['auth'],
        response: openApiResponse(AuthMessageResponseSchema, 'AuthMessage'),
      },
    },
    async (request, reply) => {
      const parsed = ChangePasswordSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' })
      }
      const userId = request.sessionUser!.id
      const user = await fastify.prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      })
      if (!user?.passwordHash) {
        return reply.status(400).send({ error: 'This account has no password yet — set one first' })
      }
      if (!(await verifyPassword(user.passwordHash, parsed.data.currentPassword))) {
        return reply.status(400).send({ error: 'Current password is wrong' })
      }

      await fastify.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await hashPassword(parsed.data.newPassword) },
      })
      await revokeOtherSessions(fastify.prisma, userId, request.authSessionId)

      return reply.send({ message: 'Password changed. Other devices were signed out.' })
    },
  )
}

export default mePasswordRoutes
