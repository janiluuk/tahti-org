// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AuthMessageResponseSchema,
  ChangeEmailSchema,
  openApiResponse,
  safeDisplayName,
} from '@tahti/shared'
import { requireSession } from '../../plugins/auth.js'
import { verifyPassword } from '../../lib/password.js'
import { generateVerificationToken, verificationExpiresAt } from '../../lib/token.js'
import { sendEmailChangeLink } from '../../lib/email.js'
import { config } from '../../config.js'

const meEmailChangeRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/me/email — start moving the account to another address. Needs
  // the password; a link goes to the new address and nothing changes until
  // it is opened. A newer request replaces any earlier unused one.
  fastify.post(
    '/api/me/email',
    {
      preHandler: requireSession,
      schema: {
        tags: ['auth'],
        response: openApiResponse(AuthMessageResponseSchema, 'AuthMessage'),
      },
    },
    async (request, reply) => {
      const parsed = ChangeEmailSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' })
      }
      const { newEmail, password } = parsed.data
      const user = await fastify.prisma.user.findUnique({
        where: { id: request.sessionUser!.id },
        select: { id: true, email: true, passwordHash: true, username: true, displayName: true },
      })
      if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
        return reply.status(400).send({ error: 'Password is wrong' })
      }
      if (newEmail === user.email.toLowerCase()) {
        return reply.status(400).send({ error: 'That is already your address' })
      }
      const taken = await fastify.prisma.user.findFirst({
        where: { email: { equals: newEmail, mode: 'insensitive' } },
        select: { id: true },
      })
      if (taken) {
        return reply.status(409).send({ error: 'Another account uses that address' })
      }

      const token = generateVerificationToken()
      await fastify.prisma.$transaction([
        fastify.prisma.emailChange.deleteMany({ where: { userId: user.id, usedAt: null } }),
        fastify.prisma.emailChange.create({
          data: { userId: user.id, newEmail, token, expiresAt: verificationExpiresAt() },
        }),
      ])
      await sendEmailChangeLink({
        to: newEmail,
        displayName: safeDisplayName(user.displayName, user.username),
        confirmUrl: `${config.appUrl.replace(/\/$/, '')}/email-change?token=${token}`,
      }).catch((err: unknown) => request.log.warn({ err }, 'email change link failed'))

      return reply.send({ message: `We sent a link to ${newEmail}. Open it to finish.` })
    },
  )
}

export default meEmailChangeRoutes
