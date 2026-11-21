// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyReply, FastifyRequest } from 'fastify'
import type { PrismaClient, User } from '@tahti/db'
import { restrictionErrorMessage } from '@tahti/db'
import { config } from '../config.js'
import { issueAuthTokens, type IssuedAuthTokens } from '../auth/tokens/issue.js'
import { createSession } from './session.js'
import { recordSignIn } from './sign-in-notice.js'
import { suspendedLoginMessage } from './suspended-login.js'
import { generateTotpChallengeId, totpChallengeExpiresAt } from './token.js'

export type LoginUser = Pick<
  User,
  'id' | 'email' | 'username' | 'displayName' | 'tier' | 'isMember' | 'isBoard'
>

export function loginDeviceLabel(
  request: FastifyRequest,
  requested?: string | null,
): string | null {
  return (
    requested?.trim() ||
    (typeof request.headers['user-agent'] === 'string'
      ? request.headers['user-agent'].slice(0, 120)
      : null)
  )
}

/**
 * Account-state gates every first sign-in factor shares (password, OAuth).
 * Returns the error to show, or null when the account may sign in.
 */
export async function loginBlockedReason(
  prisma: PrismaClient,
  user: Pick<User, 'id' | 'suspendedAt' | 'suspendReason' | 'deletedAt'>,
): Promise<string | null> {
  if (user.suspendedAt) return suspendedLoginMessage(user.suspendReason)
  if (user.deletedAt) return 'This account has been deleted'
  return restrictionErrorMessage(prisma, user.id, 'LOGIN')
}

/** Second-factor step for an account with 2FA on; completed by POST /api/auth/login/totp. */
export async function createTotpChallenge(prisma: PrismaClient, userId: string): Promise<string> {
  const challenge = await prisma.totpChallenge.create({
    data: { id: generateTotpChallengeId(), userId, expiresAt: totpChallengeExpiresAt() },
  })
  return challenge.id
}

/** New session row + session cookie + access/refresh token pair. */
export async function startLoginSession(
  prisma: PrismaClient,
  request: FastifyRequest,
  reply: FastifyReply,
  user: LoginUser,
  opts: { deviceLabel: string | null; includeRefreshInBody?: boolean },
): Promise<IssuedAuthTokens> {
  const session = await createSession(prisma, user.id, { deviceLabel: opts.deviceLabel })

  void recordSignIn(prisma, user, opts.deviceLabel, request.log)

  reply.setCookie(config.sessionCookieName, session.id, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    maxAge: config.sessionMaxAgeSec,
    path: '/',
    domain: config.sessionCookieDomain,
  })

  return issueAuthTokens(prisma, reply, {
    user,
    session,
    deviceLabel: opts.deviceLabel,
    includeRefreshInBody: opts.includeRefreshInBody,
  })
}
