// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { VerifyEmailSchema } from '@tahti/shared'

const verifyRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/auth/verify', async (request, reply) => {
    const parsed = VerifyEmailSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Missing or invalid token' })
    }

    const { token } = parsed.data

    const verification = await fastify.prisma.emailVerification.findUnique({
      where: { token },
      include: { user: { select: { id: true, emailVerifiedAt: true } } },
    })

    if (!verification) {
      return reply.status(400).send({ error: 'Invalid verification token' })
    }

    if (verification.usedAt) {
      return reply.status(400).send({ error: 'Token already used' })
    }

    if (verification.expiresAt < new Date()) {
      return reply.status(400).send({ error: 'Token expired' })
    }

    if (verification.user.emailVerifiedAt) {
      return reply.status(400).send({ error: 'Email already verified' })
    }

    await fastify.prisma.$transaction([
      fastify.prisma.user.update({
        where: { id: verification.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      fastify.prisma.membership.update({
        where: { userId: verification.userId },
        data: { status: 'PENDING_PAYMENT' },
      }),
      fastify.prisma.emailVerification.update({
        where: { id: verification.id },
        data: { usedAt: new Date() },
      }),
    ])

    return reply.send({
      message:
        'Email verified — log in and complete your €40 annual membership payment to join Tahti ry',
    })
  })
}

export default verifyRoute
