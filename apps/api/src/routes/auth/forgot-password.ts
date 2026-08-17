// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { AuthMessageResponseSchema, ForgotPasswordSchema, openApiResponse } from '@tahti/shared'
import { passwordResetExpiresAt, generateVerificationToken } from '../../lib/token.js'
import { sendPasswordResetEmail } from '../../lib/email.js'
import { verifyHcaptcha } from '../../lib/hcaptcha.js'
import { config } from '../../config.js'

const GENERIC_MESSAGE = 'If an account exists for that email, we sent a password reset link.'

const forgotPasswordRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/auth/forgot-password',
    {
      schema: {
        tags: ['auth'],
        response: openApiResponse(AuthMessageResponseSchema, 'AuthMessage'),
      },
    },
    async (request, reply) => {
      const parsed = ForgotPasswordSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid email address' })
      }

      if (!(await verifyHcaptcha(parsed.data.hcaptchaToken))) {
        return reply.status(400).send({ error: 'hCaptcha verification failed' })
      }

      // Constant response regardless of match — don't let this endpoint be
      // used to enumerate registered emails.
      const user = await fastify.prisma.user.findUnique({
        where: { email: parsed.data.email },
        select: {
          id: true,
          email: true,
          displayName: true,
          passwordHash: true,
          deletedAt: true,
          suspendedAt: true,
        },
      })

      if (user && user.passwordHash && !user.deletedAt && !user.suspendedAt) {
        const token = generateVerificationToken()
        await fastify.prisma.passwordSetup.create({
          data: { userId: user.id, token, expiresAt: passwordResetExpiresAt() },
        })
        const resetUrl = `${config.appUrl}/reset-password?token=${token}`
        sendPasswordResetEmail(user.email, user.displayName, resetUrl).catch((err: unknown) =>
          fastify.log.error({ err }, 'Failed to send password reset email'),
        )
      }

      return reply.send({ message: GENERIC_MESSAGE })
    },
  )
}

export default forgotPasswordRoute
