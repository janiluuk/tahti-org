// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import fp from 'fastify-plugin'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import type { Channel, User } from '@tahti/db'
import { validateSession } from '../lib/session.js'
import { validateApiToken, TOKEN_PREFIX } from '../lib/api-token.js'
import { config } from '../config.js'
import { sessionCookieCandidates } from '../lib/session-cookie.js'
import { looksLikeAccessJwt, verifyAccessToken } from '../auth/tokens/access-jwt.js'

declare module 'fastify' {
  interface FastifyRequest {
    sessionUser: User | null
    /** Non-null only when auth came from a personal API token (Authorization: Bearer),
     * as opposed to the session cookie. Drives the read/write scope check below. */
    apiTokenScopes: string[] | null
    /** Session id for cookie or access-JWT auth (not API tokens). */
    authSessionId: string | null
    /** Set by requireArtist once it's confirmed sessionUser owns a channel. */
    channel: Channel | null
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

declare module 'fastify' {
  interface FastifyContextConfig {
    /** Opt out of the method-based read/write gate below. Only for routes
     * whose transport doesn't map read/write onto HTTP verbs — currently
     * just the MCP endpoint, which is POST for every call including
     * read-only tool invocations. Those routes must do their own per-tool
     * scope check against `request.apiTokenScopes` instead. */
    methodScopeCheckExempt?: boolean
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('sessionUser', null)
  fastify.decorateRequest('apiTokenScopes', null)
  fastify.decorateRequest('authSessionId', null)
  fastify.decorateRequest('channel', null)

  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      const rawToken = authHeader.slice('Bearer '.length).trim()
      if (rawToken.startsWith(TOKEN_PREFIX)) {
        const result = await validateApiToken(fastify.prisma, rawToken)
        if (!result) {
          return reply.status(401).send({ error: 'Invalid or expired API token' })
        }
        const exempt = request.routeOptions.config?.methodScopeCheckExempt === true
        if (!exempt && !SAFE_METHODS.has(request.method) && !result.token.scopes.includes('write')) {
          return reply.status(403).send({ error: 'This API token does not have write access' })
        }
        request.sessionUser = result.user
        request.apiTokenScopes = result.token.scopes
        return
      }

      if (looksLikeAccessJwt(rawToken)) {
        const claims = verifyAccessToken(rawToken)
        if (!claims) {
          return reply.status(401).send({ error: 'Invalid or expired access token' })
        }
        const session = await validateSession(fastify.prisma, claims.sid)
        if (!session || session.userId !== claims.sub) {
          return reply.status(401).send({ error: 'Invalid or expired access token' })
        }
        if (session.user.suspendedAt) {
          return reply.status(403).send({ error: 'This account has been suspended' })
        }
        request.sessionUser = session.user
        request.authSessionId = session.id
        return
      }
    }

    const sessionIds = sessionCookieCandidates(
      request.headers.cookie,
      config.sessionCookieName,
      request.cookies[config.sessionCookieName],
    )
    for (const sessionId of sessionIds) {
      const session = await validateSession(fastify.prisma, sessionId)
      if (!session) continue
      request.sessionUser = session.user
      request.authSessionId = session.id
      break
    }
  })
}

export default fp(authPlugin, { name: 'auth', dependencies: ['db'] })

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.sessionUser) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
  if (request.sessionUser.suspendedAt) {
    request.sessionUser = null
    return reply.status(401).send({ error: 'Account suspended' })
  }
}

export async function requireSession(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply)
  if (reply.sent) return
  if (request.apiTokenScopes !== null) {
    return reply.status(403).send({
      error: 'Sign in on tahti.live to do this. An API token cannot.',
      code: 'session_required',
    })
  }
}

export async function requireMember(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply)
  if (reply.sent) return
  if (!request.sessionUser?.isMember) {
    return reply.status(403).send({ error: 'Members only' })
  }
}

export async function requireBoard(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply)
  if (reply.sent) return
  if (!request.sessionUser?.isBoard) {
    return reply.status(403).send({ error: 'Board members only' })
  }
}

export async function requireArtist(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply)
  if (reply.sent) return
  const channel = await request.server.prisma.channel.findUnique({
    where: { userId: request.sessionUser!.id },
  })
  if (!channel) {
    return reply.status(404).send({ error: 'Channel not found' })
  }
  request.channel = channel
}
