// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ResetPasswordBodySchema,
  ResetPasswordInfoSchema,
  ResetPasswordQuerySchema,
  ResetPasswordResponseSchema,
  openApiResponse,
  openApiResponses,
} from '@tahti/shared'
import { hashPassword } from '../../lib/password.js'
import { createSession, revokeAllSessions } from '../../lib/session.js'
import { config } from '../../config.js'

const resetPasswordRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/auth/reset-password',
    {
      schema: {
        tags: ['auth'],
        response: openApiResponse(ResetPasswordInfoSchema, 'ResetPasswordInfo'),
      },
    },
    async (request, reply) => {
      const parsed = ResetPasswordQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Missing or invalid token' })
      }

      const reset = await fastify.prisma.passwordSetup.findUnique({
        where: { token: parsed.data.token },
        include: {
          user: {
            select: {
              email: true,
              username: true,
              displayName: true,
              deletedAt: true,
              suspendedAt: true,
            },
          },
        },
      })

      if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
        return reply.status(400).send({ error: 'Invalid or expired reset link' })
      }
      if (reset.user.deletedAt || reset.user.suspendedAt) {
        return reply.status(403).send({ error: 'This account is not available' })
      }

      return reply.send({
        email: reset.user.email,
        username: reset.user.username,
        displayName: reset.user.displayName,
      })
    },
  )

  fastify.post(
    '/api/auth/reset-password',
    {
      schema: {
        tags: ['auth'],
        response: openApiResponses([
          { status: 200, schema: ResetPasswordResponseSchema, name: 'ResetPassword' },
        ]),
      },
    },
    async (request, reply) => {
      const parsed = ResetPasswordBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }

      const reset = await fastify.prisma.passwordSetup.findUnique({
        where: { token: parsed.data.token },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              displayName: true,
              deletedAt: true,
              suspendedAt: true,
            },
          },
        },
      })

      if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
        return reply.status(400).send({ error: 'Invalid or expired reset link' })
      }
      if (reset.user.deletedAt || reset.user.suspendedAt) {
        return reply.status(403).send({ error: 'This account is not available' })
      }

      const passwordHash = await hashPassword(parsed.data.password)

      await fastify.prisma.$transaction([
        fastify.prisma.user.update({
          where: { id: reset.userId },
          data: { passwordHash },
        }),
        fastify.prisma.passwordSetup.update({
          where: { id: reset.id },
          data: { usedAt: new Date() },
        }),
      ])

      // A password reset can follow a compromised-credentials scenario —
      // kick out every other session the same way a fresh login does (SEC-010).
      await revokeAllSessions(fastify.prisma, reset.userId)
      const session = await createSession(fastify.prisma, reset.userId)
      reply.setCookie(config.sessionCookieName, session.id, {
        httpOnly: true,
        secure: config.isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: config.sessionMaxAgeSec,
      })

      return reply.send({
        ok: true as const,
        user: {
          id: reset.user.id,
          email: reset.user.email,
          username: reset.user.username,
          displayName: reset.user.displayName,
        },
      })
    },
  )
}

export default resetPasswordRoute
