// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { AuthMessageResponseSchema, ResendVerificationSchema, openApiResponse } from '@tahti/shared'
import { generateVerificationToken, verificationExpiresAt } from '../../lib/token.js'
import { sendVerificationEmail } from '../../lib/email.js'
import { verifyHcaptcha } from '../../lib/hcaptcha.js'

const GENERIC_MESSAGE = 'If that account needs verifying, we sent a new link to its email address.'

const resendVerificationRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/auth/resend-verification',
    {
      schema: {
        tags: ['auth'],
        response: openApiResponse(AuthMessageResponseSchema, 'AuthMessage'),
      },
    },
    async (request, reply) => {
      const parsed = ResendVerificationSchema.safeParse(request.body)
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
          emailVerifiedAt: true,
          deletedAt: true,
        },
      })

      if (user && !user.emailVerifiedAt && !user.deletedAt) {
        const token = generateVerificationToken()
        await fastify.prisma.emailVerification.create({
          data: { userId: user.id, token, expiresAt: verificationExpiresAt() },
        })
        sendVerificationEmail(user.email, user.displayName, token).catch((err: unknown) =>
          fastify.log.error({ err }, 'Failed to resend verification email'),
        )
      }

      return reply.send({ message: GENERIC_MESSAGE })
    },
  )
}

export default resendVerificationRoute
