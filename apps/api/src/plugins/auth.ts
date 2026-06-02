// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

import fp from 'fastify-plugin'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import type { User } from '@tahti/db'
import { validateSession } from '../lib/session.js'
import { config } from '../config.js'

declare module 'fastify' {
  interface FastifyRequest {
    sessionUser: User | null
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('sessionUser', null)

  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    const sessionId = request.cookies[config.sessionCookieName]
    if (!sessionId) return

    const session = await validateSession(fastify.prisma, sessionId)
    if (session) {
      request.sessionUser = session.user
    }
  })
}

export default fp(authPlugin, { name: 'auth', dependencies: ['db'] })

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.sessionUser) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
}
