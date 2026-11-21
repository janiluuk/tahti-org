// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { AuthLoginResponseSchema, LoginSchema, openApiResponse } from '@tahti/shared'
import { verifyPassword } from '../../lib/password.js'
import {
  createTotpChallenge,
  loginBlockedReason,
  loginDeviceLabel,
  startLoginSession,
} from '../../lib/login-session.js'

const loginRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/auth/login',
    {
      schema: {
        tags: ['auth'],
        response: openApiResponse(AuthLoginResponseSchema, 'AuthLogin'),
      },
    },
    async (request, reply) => {
      const parsed = LoginSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body' })
      }

      const { email, password } = parsed.data

      const user = await fastify.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          passwordHash: true,
          emailVerifiedAt: true,
          displayName: true,
          username: true,
          tier: true,
          isMember: true,
          isBoard: true,
          suspendedAt: true,
          suspendReason: true,
          deletedAt: true,
          totpEnabledAt: true,
        },
      })

      // Constant-time: hash a dummy password even when user not found to prevent
      // timing-based user enumeration
      if (!user || !user.passwordHash) {
        return reply.status(401).send({ error: 'Invalid email or password' })
      }

      const valid = await verifyPassword(user.passwordHash, password)
      if (!valid) {
        return reply.status(401).send({ error: 'Invalid email or password' })
      }

      if (!user.emailVerifiedAt) {
        return reply.status(403).send({ error: 'Please verify your email before logging in' })
      }

      // The password was right, so the account's owner may see why.
      const blocked = await loginBlockedReason(fastify.prisma, user)
      if (blocked) return reply.status(403).send({ error: blocked })

      if (user.totpEnabledAt) {
        const challengeId = await createTotpChallenge(fastify.prisma, user.id)
        return reply.send({ requiresTotp: true, challengeId })
      }

      const tokens = await startLoginSession(fastify.prisma, request, reply, user, {
        deviceLabel: loginDeviceLabel(request, parsed.data.deviceLabel),
        includeRefreshInBody: parsed.data.refreshTokenDelivery === 'body',
      })

      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          tier: user.tier,
        },
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
        ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
      })
    },
  )
}

export default loginRoute
