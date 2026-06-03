// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { deleteSession } from '../../lib/session.js'
import { config } from '../../config.js'

const logoutRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/auth/logout', async (request, reply) => {
    const sessionId = request.cookies[config.sessionCookieName]
    if (sessionId) {
      await deleteSession(fastify.prisma, sessionId)
    }

    reply.clearCookie(config.sessionCookieName, { path: '/' })
    return reply.send({ message: 'Logged out' })
  })
}

export default logoutRoute
