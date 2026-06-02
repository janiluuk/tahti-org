// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

import type { FastifyPluginAsync } from 'fastify'
import { RegisterSchema } from '@tahti/shared'
import { hashPassword } from '../../lib/password.js'
import { generateVerificationToken, verificationExpiresAt } from '../../lib/token.js'
import { sendVerificationEmail } from '../../lib/email.js'
import { verifyHcaptcha } from '../../lib/hcaptcha.js'
import { nanoid } from 'nanoid'

const registerRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/auth/register', async (request, reply) => {
    const parsed = RegisterSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      })
    }

    const { email, password, username, displayName } = parsed.data
    const hcaptchaToken = (request.body as { hcaptchaToken?: string }).hcaptchaToken
    if (!(await verifyHcaptcha(hcaptchaToken))) {
      return reply.status(400).send({ error: 'hCaptcha verification failed' })
    }

    // Check uniqueness
    const existing = await fastify.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { email: true, username: true },
    })

    if (existing) {
      const field = existing.email === email ? 'email' : 'username'
      return reply.status(409).send({ error: `${field} is already taken` })
    }

    const passwordHash = await hashPassword(password)

    // Derive channel slug from username (same value for now)
    const channelSlug = username
    // Generate live source credentials (rotatable later from dashboard)
    const liveSourceMount = `/live/${channelSlug}`
    const liveSourcePass = nanoid(24)
    const rtmpStreamKey = `${channelSlug}__${nanoid(32)}`
    const liveSourcePassHash = await hashPassword(liveSourcePass)
    const rtmpStreamKeyHash = await hashPassword(rtmpStreamKey)

    const user = await fastify.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email,
          passwordHash,
          username,
          displayName,
          membership: { create: {} },
          channel: {
            create: {
              slug: channelSlug,
              liveSourceMount,
              liveSourcePass,
              liveSourcePassHash,
              rtmpStreamKey,
              rtmpStreamKeyHash,
            },
          },
        },
        select: { id: true, email: true, displayName: true },
      })

      const token = generateVerificationToken()
      await tx.emailVerification.create({
        data: {
          userId: u.id,
          token,
          expiresAt: verificationExpiresAt(),
        },
      })

      return { ...u, verificationToken: token }
    })

    // Fire-and-forget email (log errors but don't fail the request)
    sendVerificationEmail(user.email, user.displayName, user.verificationToken).catch(
      (err: unknown) => fastify.log.error({ err }, 'Failed to send verification email'),
    )

    return reply.status(201).send({
      message: 'Registration successful — check your email to verify your address',
      userId: user.id,
    })
  })
}

export default registerRoute
