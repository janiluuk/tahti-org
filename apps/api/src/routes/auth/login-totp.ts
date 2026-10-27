// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { AuthLoginResponseSchema, LoginTotpSchema, openApiResponse } from '@tahti/shared'
import { createSession } from '../../lib/session.js'
import { issueAuthTokens } from '../../auth/tokens/index.js'
import { config } from '../../config.js'
import { verifyTotpCode } from '../../lib/totp.js'
import { decryptTotpSecret } from '../../lib/totp-secret-enc.js'
import { verifyPassword } from '../../lib/password.js'
import { normalizeBackupCode } from '../../lib/totp-backup-codes.js'
import { recordSignIn } from '../../lib/sign-in-notice.js'
import { restrictionErrorMessage } from '@tahti/db'
import { suspendedLoginMessage } from '../../lib/suspended-login.js'

const loginTotpRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/auth/login/totp',
    {
      schema: {
        tags: ['auth'],
        response: openApiResponse(AuthLoginResponseSchema, 'AuthLogin'),
      },
    },
    async (request, reply) => {
      const parsed = LoginTotpSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body' })
      }
      const { challengeId, code } = parsed.data

      const challenge = await fastify.prisma.totpChallenge.findUnique({
        where: { id: challengeId },
      })
      if (!challenge || challenge.expiresAt < new Date()) {
        if (challenge) await fastify.prisma.totpChallenge.delete({ where: { id: challenge.id } })
        return reply.status(401).send({ error: 'Login challenge expired — sign in again' })
      }

      const user = await fastify.prisma.user.findUnique({
        where: { id: challenge.userId },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          tier: true,
          isMember: true,
          isBoard: true,
          totpSecretEnc: true,
          totpEnabledAt: true,
          suspendedAt: true,
          suspendReason: true,
        },
      })
      if (!user || !user.totpEnabledAt || !user.totpSecretEnc) {
        return reply.status(401).send({ error: 'Invalid login challenge' })
      }
      // Same as the restriction check below: the board may suspend the
      // account while its challenge is still valid.
      if (user.suspendedAt) {
        await fastify.prisma.totpChallenge.delete({ where: { id: challenge.id } })
        return reply.status(403).send({ error: suspendedLoginMessage(user.suspendReason) })
      }

      // The initial /api/auth/login step already checks this before ever
      // issuing a challenge — re-checked here too, since a restriction
      // applied while an already-issued challenge is still valid (a few
      // minutes) would otherwise let it complete without ever touching that
      // check.
      const loginBanError = await restrictionErrorMessage(fastify.prisma, user.id, 'LOGIN')
      if (loginBanError) return reply.status(403).send({ error: loginBanError })

      const secret = decryptTotpSecret(user.totpSecretEnc)
      let ok = verifyTotpCode(secret, code)

      if (!ok) {
        const normalized = normalizeBackupCode(code)
        const backupCodes = await fastify.prisma.totpBackupCode.findMany({
          where: { userId: user.id, usedAt: null },
        })
        for (const backup of backupCodes) {
          if (await verifyPassword(backup.codeHash, normalized)) {
            await fastify.prisma.totpBackupCode.update({
              where: { id: backup.id },
              data: { usedAt: new Date() },
            })
            ok = true
            break
          }
        }
      }

      if (!ok) {
        return reply.status(401).send({ error: 'Invalid code' })
      }

      await fastify.prisma.totpChallenge.delete({ where: { id: challenge.id } })

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

export default loginTotpRoute
