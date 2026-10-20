// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyReply } from 'fastify'
import type { PrismaClient, Session, User } from '@tahti/db'
import { signAccessToken } from './access-jwt.js'
import { createRefreshTokenFamily } from './refresh.js'
import { setRefreshCookie } from './cookies.js'

export type IssuedAuthTokens = {
  accessToken: string
  expiresIn: number
  refreshToken: string
}

export async function issueAuthTokens(
  prisma: PrismaClient,
  reply: FastifyReply,
  input: {
    user: Pick<User, 'id' | 'tier' | 'isMember' | 'isBoard'>
    session: Session
    deviceLabel?: string | null
    /** When true, also return refreshToken in the JSON body (native/CLI). */
    includeRefreshInBody?: boolean
  },
): Promise<IssuedAuthTokens> {
  const refresh = await createRefreshTokenFamily(prisma, {
    userId: input.user.id,
    sessionId: input.session.id,
    deviceLabel: input.deviceLabel ?? input.session.deviceLabel,
  })
  const access = signAccessToken({
    userId: input.user.id,
    sessionId: input.session.id,
    tier: input.user.tier,
    isMember: input.user.isMember,
    isBoard: input.user.isBoard,
  })
  setRefreshCookie(reply, refresh.plaintext)
  return {
    accessToken: access.token,
    expiresIn: access.expiresIn,
    refreshToken: refresh.plaintext,
  }
}
