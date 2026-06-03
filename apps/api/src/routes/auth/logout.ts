// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { AuthMessageResponseSchema, openApiResponse } from '@tahti/shared'
import { deleteSession } from '../../lib/session.js'
import { config } from '../../config.js'

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
      const sessionId = request.cookies[config.sessionCookieName]
      if (sessionId) {
        await deleteSession(fastify.prisma, sessionId)
      }

      reply.clearCookie(config.sessionCookieName, { path: '/' })
      return reply.send({ message: 'Logged out' })
    },
  )
}

export default logoutRoute
