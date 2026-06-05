// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  SetupPasswordBodySchema,
  SetupPasswordInfoSchema,
  SetupPasswordQuerySchema,
  SetupPasswordResponseSchema,
  openApiResponse,
  openApiResponses,
} from '@tahti/shared'
import { hashPassword } from '../../lib/password.js'
import { createSession } from '../../lib/session.js'
import { config } from '../../config.js'

const setupPasswordRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/auth/setup-password',
    {
      schema: {
        tags: ['auth'],
        response: openApiResponse(SetupPasswordInfoSchema, 'SetupPasswordInfo'),
      },
    },
    async (request, reply) => {
      const parsed = SetupPasswordQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Missing or invalid token' })
      }

      const setup = await fastify.prisma.passwordSetup.findUnique({
        where: { token: parsed.data.token },
        include: {
          user: {
            select: {
              email: true,
              username: true,
              displayName: true,
              passwordHash: true,
              deletedAt: true,
              suspendedAt: true,
            },
          },
        },
      })

      if (!setup || setup.usedAt || setup.expiresAt < new Date()) {
        return reply.status(400).send({ error: 'Invalid or expired setup link' })
      }
      if (setup.user.passwordHash) {
        return reply.status(400).send({ error: 'Password already set — log in instead' })
      }
      if (setup.user.deletedAt || setup.user.suspendedAt) {
        return reply.status(403).send({ error: 'This account is not available' })
      }

      return reply.send({
        email: setup.user.email,
        username: setup.user.username,
        displayName: setup.user.displayName,
      })
    },
  )

  fastify.post(
    '/api/auth/setup-password',
    {
      schema: {
        tags: ['auth'],
        response: openApiResponses([
          { status: 200, schema: SetupPasswordResponseSchema, name: 'SetupPassword' },
        ]),
      },
    },
    async (request, reply) => {
      const parsed = SetupPasswordBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }

      const setup = await fastify.prisma.passwordSetup.findUnique({
        where: { token: parsed.data.token },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              displayName: true,
              passwordHash: true,
              emailVerifiedAt: true,
              deletedAt: true,
              suspendedAt: true,
            },
          },
        },
      })

      if (!setup || setup.usedAt || setup.expiresAt < new Date()) {
        return reply.status(400).send({ error: 'Invalid or expired setup link' })
      }
      if (setup.user.passwordHash) {
        return reply.status(400).send({ error: 'Password already set — log in instead' })
      }
      if (setup.user.deletedAt || setup.user.suspendedAt) {
        return reply.status(403).send({ error: 'This account is not available' })
      }

      const passwordHash = await hashPassword(parsed.data.password)

      await fastify.prisma.$transaction([
        fastify.prisma.user.update({
          where: { id: setup.userId },
          data: { passwordHash },
        }),
        fastify.prisma.passwordSetup.update({
          where: { id: setup.id },
          data: { usedAt: new Date() },
        }),
      ])

      const session = await createSession(fastify.prisma, setup.userId)
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
          id: setup.user.id,
          email: setup.user.email,
          username: setup.user.username,
          displayName: setup.user.displayName,
        },
      })
    },
  )
}

export default setupPasswordRoute
