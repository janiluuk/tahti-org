// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { AuthLoginResponseSchema, LoginSchema, openApiResponse } from '@tahti/shared'
import { restrictionErrorMessage } from '@tahti/db'
import { verifyPassword } from '../../lib/password.js'
import { createSession } from '../../lib/session.js'
import { issueAuthTokens } from '../../auth/tokens/index.js'
import { generateTotpChallengeId, totpChallengeExpiresAt } from '../../lib/token.js'
import { config } from '../../config.js'
import { recordSignIn } from '../../lib/sign-in-notice.js'
import { suspendedLoginMessage } from '../../lib/suspended-login.js'

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
      if (user.suspendedAt) {
        return reply.status(403).send({ error: suspendedLoginMessage(user.suspendReason) })
      }

      if (user.deletedAt) {
        return reply.status(403).send({ error: 'This account has been deleted' })
      }

      const loginBanError = await restrictionErrorMessage(fastify.prisma, user.id, 'LOGIN')
      if (loginBanError) return reply.status(403).send({ error: loginBanError })

      if (user.totpEnabledAt) {
        const challenge = await fastify.prisma.totpChallenge.create({
          data: {
            id: generateTotpChallengeId(),
            userId: user.id,
            expiresAt: totpChallengeExpiresAt(),
          },
        })
        return reply.send({ requiresTotp: true, challengeId: challenge.id })
      }

      const deviceLabel =
        parsed.data.deviceLabel?.trim() ||
        (typeof request.headers['user-agent'] === 'string'
          ? request.headers['user-agent'].slice(0, 120)
          : null)
      const session = await createSession(fastify.prisma, user.id, { deviceLabel })

      void recordSignIn(fastify.prisma, user, deviceLabel, request.log)

      reply.setCookie(config.sessionCookieName, session.id, {
        httpOnly: true,
        secure: config.isProd,
        sameSite: 'lax',
        maxAge: config.sessionMaxAgeSec,
        path: '/',
        domain: config.sessionCookieDomain,
      })

      const tokens = await issueAuthTokens(fastify.prisma, reply, {
        user,
        session,
        deviceLabel,
        includeRefreshInBody: true,
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
        refreshToken: tokens.refreshToken,
      })
    },
  )
}

export default loginRoute
