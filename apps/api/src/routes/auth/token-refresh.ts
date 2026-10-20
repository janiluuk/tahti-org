// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { AuthTokenRefreshResponseSchema, openApiResponse } from '@tahti/shared'
import { config } from '../../config.js'
import { signAccessToken } from '../../auth/tokens/access-jwt.js'
import { rotateRefreshToken } from '../../auth/tokens/refresh.js'
import { clearRefreshCookie, setRefreshCookie } from '../../auth/tokens/cookies.js'

const BodySchema = z.object({
  refreshToken: z.string().min(1).optional(),
})

const tokenRefreshRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/auth/token/refresh',
    {
      schema: {
        tags: ['auth'],
        response: openApiResponse(AuthTokenRefreshResponseSchema, 'AuthTokenRefresh'),
      },
    },
    async (request, reply) => {
      const parsed = BodySchema.safeParse(request.body ?? {})
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid request body' })
      }
      const fromCookie = request.cookies[config.refreshCookieName]
      const plaintext = parsed.data.refreshToken || fromCookie
      if (!plaintext) {
        return reply.status(401).send({ error: 'Missing refresh token' })
      }

      const result = await rotateRefreshToken(fastify.prisma, plaintext)
      if ('kind' in result) {
        clearRefreshCookie(reply)
        const status = result.kind === 'reuse' ? 401 : 401
        return reply.status(status).send({
          error: result.kind === 'reuse' ? 'Refresh token reuse detected' : 'Invalid refresh token',
        })
      }

      const access = signAccessToken({
        userId: result.user.id,
        sessionId: result.session.id,
        tier: result.user.tier,
        isMember: result.user.isMember,
        isBoard: result.user.isBoard,
      })
      setRefreshCookie(reply, result.plaintext)

      const includeBody = Boolean(parsed.data.refreshToken)
      return reply.send({
        accessToken: access.token,
        expiresIn: access.expiresIn,
        ...(includeBody ? { refreshToken: result.plaintext } : {}),
      })
    },
  )
}

export default tokenRefreshRoute
