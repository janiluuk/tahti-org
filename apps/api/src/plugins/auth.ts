// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import fp from 'fastify-plugin'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import type { Channel, User } from '@tahti/db'
import { validateSession } from '../lib/session.js'
import { validateApiToken, TOKEN_PREFIX } from '../lib/api-token.js'
import { config } from '../config.js'
import { sessionCookieCandidates } from '../lib/session-cookie.js'

declare module 'fastify' {
  interface FastifyRequest {
    sessionUser: User | null
    /** Non-null only when auth came from a personal API token (Authorization: Bearer),
     * as opposed to the session cookie. Drives the read/write scope check below. */
    apiTokenScopes: string[] | null
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
  fastify.decorateRequest('channel', null)

  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization
    // Only claim Bearer tokens that look like personal API tokens (`tahti_...`).
    // Other Bearer schemes — e.g. internal service-to-service secrets checked by
    // individual routes — must fall through untouched rather than getting 401'd here.
    if (authHeader?.startsWith(`Bearer ${TOKEN_PREFIX}`)) {
      const rawToken = authHeader.slice('Bearer '.length).trim()
      const result = await validateApiToken(fastify.prisma, rawToken)
      if (!result) {
        return reply.status(401).send({ error: 'Invalid or expired API token' })
      }
      // A read-only token can look but not touch: every mutating request needs 'write'.
      const exempt = request.routeOptions.config?.methodScopeCheckExempt === true
      if (!exempt && !SAFE_METHODS.has(request.method) && !result.token.scopes.includes('write')) {
        return reply.status(403).send({ error: 'This API token does not have write access' })
      }
      request.sessionUser = result.user
      request.apiTokenScopes = result.token.scopes
      return
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
      break
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

// Artist-only routes (has a channel). Decorates request.channel so the route
// doesn't have to re-run the same findUnique-or-404 lookup every route did
// ad hoc before this existed (see e.g. routes/me/profile.ts).
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
