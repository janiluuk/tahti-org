// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AuthMessageResponseSchema,
  AuthSessionListResponseSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'
import { deleteSession, revokeAllSessions } from '../../lib/session.js'
import { revokeAllRefreshForUser, revokeRefreshForSession } from '../../auth/tokens/refresh.js'
import { clearRefreshCookie } from '../../auth/tokens/cookies.js'
import { sessionCookieCandidates } from '../../lib/session-cookie.js'

const sessionsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/sessions',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['auth'],
        response: openApiResponse(AuthSessionListResponseSchema, 'AuthSessionList'),
      },
    },
    async (request, reply) => {
      const userId = request.sessionUser!.id
      const currentIds = new Set(
        sessionCookieCandidates(
          request.headers.cookie,
          config.sessionCookieName,
          request.cookies[config.sessionCookieName],
        ),
      )
      if (request.authSessionId) currentIds.add(request.authSessionId)

      const sessions = await fastify.prisma.session.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          refreshTokens: {
            orderBy: { lastUsedAt: 'desc' },
            take: 1,
          },
        },
      })

      return reply.send({
        sessions: sessions.map((s) => ({
          id: s.id,
          deviceLabel: s.deviceLabel ?? s.refreshTokens[0]?.deviceLabel ?? null,
          createdAt: s.createdAt,
          lastUsedAt: s.refreshTokens[0]?.lastUsedAt ?? null,
          current: currentIds.has(s.id),
        })),
      })
    },
  )

  fastify.delete(
    '/api/me/sessions/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['auth'],
        response: openApiResponse(AuthMessageResponseSchema, 'AuthMessage'),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const session = await fastify.prisma.session.findFirst({
        where: { id, userId: request.sessionUser!.id },
      })
      if (!session) {
        return reply.status(404).send({ error: 'Session not found' })
      }
      await revokeRefreshForSession(fastify.prisma, id)
      await deleteSession(fastify.prisma, id)
      if (request.authSessionId === id) {
        reply.clearCookie(config.sessionCookieName, {
          path: '/',
          domain: config.sessionCookieDomain,
        })
        clearRefreshCookie(reply)
      }
      return reply.send({ message: 'Session revoked' })
    },
  )

  fastify.delete(
    '/api/me/sessions',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['auth'],
        response: openApiResponse(AuthMessageResponseSchema, 'AuthMessage'),
      },
    },
    async (request, reply) => {
      const userId = request.sessionUser!.id
      await revokeAllRefreshForUser(fastify.prisma, userId)
      await revokeAllSessions(fastify.prisma, userId)
      reply.clearCookie(config.sessionCookieName, {
        path: '/',
        domain: config.sessionCookieDomain,
      })
      clearRefreshCookie(reply)
      return reply.send({ message: 'Signed out everywhere' })
    },
  )
}

export default sessionsRoute
