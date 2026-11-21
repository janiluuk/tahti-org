// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AuthMessageResponseSchema,
  ChangePasswordSchema,
  SetPasswordSchema,
  openApiNoContentResponse,
  openApiResponse,
  safeDisplayName,
} from '@tahti/shared'
import { requireSession } from '../../plugins/auth.js'
import { hashPassword, verifyPassword } from '../../lib/password.js'
import { revokeOtherSessions } from '../../lib/session.js'
import { sendSecurityNotice } from '../../lib/security-email.js'

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
        select: { passwordHash: true, email: true, username: true, displayName: true },
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
      // A reset link mailed before the change would undo it.
      await fastify.prisma.passwordSetup.deleteMany({ where: { userId, usedAt: null } })
      await sendSecurityNotice(
        {
          to: user.email,
          displayName: safeDisplayName(user.displayName, user.username),
          subject: 'Your Tahti password was changed',
          what: 'The password on your Tahti account was just changed, and your other devices were signed out.',
        },
        request.log,
      )

      return reply.send({ message: 'Password changed. Other devices were signed out.' })
    },
  )

  fastify.post(
    '/api/me/password/set',
    {
      preHandler: requireSession,
      schema: {
        tags: ['auth'],
        summary: 'Set a first password',
        description:
          'For an account created with Google/Facebook. 204 on success; sessions stay signed in. 409 when the account already has a password (use POST /api/me/password).',
        response: openApiNoContentResponse(204),
      },
    },
    async (request, reply) => {
      const parsed = SetPasswordSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' })
      }
      const userId = request.sessionUser!.id
      const passwordHash = await hashPassword(parsed.data.password)
      // Conditional on passwordHash still being null so two concurrent requests
      // cannot both succeed, and this route can never replace an existing password.
      const { count } = await fastify.prisma.user.updateMany({
        where: { id: userId, passwordHash: null },
        data: { passwordHash },
      })
      if (count === 0) {
        return reply
          .status(409)
          .send({ error: 'This account already has a password. Change it instead.' })
      }
      // A reset link mailed before this would replace the password just set.
      await fastify.prisma.passwordSetup.deleteMany({ where: { userId, usedAt: null } })

      const user = request.sessionUser!
      await sendSecurityNotice(
        {
          to: user.email,
          displayName: safeDisplayName(user.displayName, user.username),
          subject: 'A password was added to your Tahti account',
          what: 'A password was just added to your Tahti account. You can now also sign in with your email address and this password.',
        },
        request.log,
      )
      return reply.status(204).send()
    },
  )
}

export default mePasswordRoutes
