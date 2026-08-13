// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import fp from 'fastify-plugin'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import type { User } from '@tahti/db'
import { validateSession } from '../lib/session.js'
import { validateApiToken } from '../lib/api-token.js'
import { config } from '../config.js'

declare module 'fastify' {
  interface FastifyRequest {
    sessionUser: User | null
    /** Non-null only when auth came from a personal API token (Authorization: Bearer),
     * as opposed to the session cookie. Drives the read/write scope check below. */
    apiTokenScopes: string[] | null
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('sessionUser', null)
  fastify.decorateRequest('apiTokenScopes', null)

  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      const rawToken = authHeader.slice('Bearer '.length).trim()
      const result = await validateApiToken(fastify.prisma, rawToken)
      if (!result) {
        return reply.status(401).send({ error: 'Invalid or expired API token' })
      }
      // A read-only token can look but not touch: every mutating request needs 'write'.
      if (!SAFE_METHODS.has(request.method) && !result.token.scopes.includes('write')) {
        return reply.status(403).send({ error: 'This API token does not have write access' })
      }
      request.sessionUser = result.user
      request.apiTokenScopes = result.token.scopes
      return
    }

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

// Members-only routes (the yhdistys register). Requires an authenticated user
// who has an active membership.
export async function requireMember(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply)
  if (reply.sent) return
  if (!request.sessionUser?.isMember) {
    return reply.status(403).send({ error: 'Members only' })
  }
}

// Board-only routes (posting/opening/closing motions, treasurer ledger entries).
export async function requireBoard(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply)
  if (reply.sent) return
  if (!request.sessionUser?.isBoard) {
    return reply.status(403).send({ error: 'Board members only' })
  }
}
