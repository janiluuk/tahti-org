// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { LoginSchema } from '@tahti/shared'
import { verifyPassword } from '../../lib/password.js'
import { createSession } from '../../lib/session.js'
import { config } from '../../config.js'

const loginRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/auth/login', async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body' })
    }

    const { email, password } = parsed.data

    const user = await fastify.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        emailVerifiedAt: true,
        displayName: true,
        username: true,
        tier: true,
      },
    })

    // Constant-time: hash a dummy password even when user not found to prevent
    // timing-based user enumeration
    const valid = user ? await verifyPassword(user.passwordHash, password) : false

    if (!user || !valid) {
      return reply.status(401).send({ error: 'Invalid email or password' })
    }

    if (!user.emailVerifiedAt) {
      return reply.status(403).send({ error: 'Please verify your email before logging in' })
    }

    const session = await createSession(fastify.prisma, user.id)

    reply.setCookie(config.sessionCookieName, session.id, {
      httpOnly: true,
      secure: config.isProd,
      sameSite: 'lax',
      maxAge: config.sessionMaxAgeSec,
      path: '/',
    })

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        tier: user.tier,
      },
    })
  })
}

export default loginRoute
