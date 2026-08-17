// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { AuthMessageResponseSchema, openApiResponse } from '@tahti/shared'
import { deleteSession } from '../../lib/session.js'
import { config } from '../../config.js'
import { sessionCookieCandidates } from '../../lib/session-cookie.js'

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
      for (const sessionId of sessionIds) {
        await deleteSession(fastify.prisma, sessionId)
      }

      reply.clearCookie(config.sessionCookieName, { path: '/', domain: config.sessionCookieDomain })
      return reply.send({ message: 'Logged out' })
    },
  )
}

export default logoutRoute
