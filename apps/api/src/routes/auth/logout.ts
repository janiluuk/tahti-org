// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { AuthMessageResponseSchema, openApiResponse } from '@tahti/shared'
import { deleteSession } from '../../lib/session.js'
import { config } from '../../config.js'
import { sessionCookieCandidates } from '../../lib/session-cookie.js'
import { clearRefreshCookie } from '../../auth/tokens/cookies.js'
import {
  revokeRefreshForSession,
  revokeRefreshFamily,
  hashRefreshToken,
} from '../../auth/tokens/refresh.js'

const logoutRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/auth/logout',
    {
      schema: {
        tags: ['auth'],
        response: openApiResponse(AuthMessageResponseSchema, 'AuthMessage'),
      },
    },
    async (request, reply) => {
      const sessionIds = sessionCookieCandidates(
        request.headers.cookie,
        config.sessionCookieName,
        request.cookies[config.sessionCookieName],
      )
      if (request.authSessionId) sessionIds.push(request.authSessionId)

      for (const sessionId of [...new Set(sessionIds)]) {
        await revokeRefreshForSession(fastify.prisma, sessionId)
        await deleteSession(fastify.prisma, sessionId)
      }

      const refreshPlain =
        request.cookies[config.refreshCookieName] ||
        (typeof (request.body as { refreshToken?: string } | null)?.refreshToken === 'string'
          ? (request.body as { refreshToken: string }).refreshToken
          : null)
      if (refreshPlain) {
        const row = await fastify.prisma.refreshToken.findUnique({
          where: { tokenHash: hashRefreshToken(refreshPlain) },
          select: { familyId: true },
        })
        if (row) await revokeRefreshFamily(fastify.prisma, row.familyId)
      }

      reply.clearCookie(config.sessionCookieName, { path: '/', domain: config.sessionCookieDomain })
      clearRefreshCookie(reply)
      return reply.send({ message: 'Logged out' })
    },
  )
}

export default logoutRoute
