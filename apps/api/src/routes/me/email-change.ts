// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AuthMessageResponseSchema,
  ChangeEmailSchema,
  ConfirmEmailChangeSchema,
  openApiResponse,
  safeDisplayName,
} from '@tahti/shared'
import { requireSession } from '../../plugins/auth.js'
import { verifyPassword } from '../../lib/password.js'
import { generateVerificationToken, verificationExpiresAt } from '../../lib/token.js'
import { sendEmailChangeLink } from '../../lib/email.js'
import { config } from '../../config.js'
import { sendSecurityNotice } from '../../lib/security-email.js'

const meEmailChangeRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/me/email — start moving the account to another address. Needs
  // the password; a link goes to the new address and nothing changes until
  // it is opened. A newer request replaces any earlier unused one.
  fastify.post(
    '/api/me/email',
    {
      preHandler: requireSession,
      schema: {
        tags: ['auth'],
        response: openApiResponse(AuthMessageResponseSchema, 'AuthMessage'),
      },
    },
    async (request, reply) => {
      const parsed = ChangeEmailSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' })
      }
      const { newEmail, password } = parsed.data
      const user = await fastify.prisma.user.findUnique({
        where: { id: request.sessionUser!.id },
        select: { id: true, email: true, passwordHash: true, username: true, displayName: true },
      })
      if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
        return reply.status(400).send({ error: 'Password is wrong' })
      }
      if (newEmail === user.email.toLowerCase()) {
        return reply.status(400).send({ error: 'That is already your address' })
      }
      const taken = await fastify.prisma.user.findFirst({
        where: { email: { equals: newEmail, mode: 'insensitive' } },
        select: { id: true },
      })
      if (taken) {
        return reply.status(409).send({ error: 'Another account uses that address' })
      }

      const token = generateVerificationToken()
      await fastify.prisma.$transaction([
        fastify.prisma.emailChange.deleteMany({ where: { userId: user.id, usedAt: null } }),
        fastify.prisma.emailChange.create({
          data: { userId: user.id, newEmail, token, expiresAt: verificationExpiresAt() },
        }),
      ])
      await sendEmailChangeLink({
        to: newEmail,
        displayName: safeDisplayName(user.displayName, user.username),
        confirmUrl: `${config.appUrl.replace(/\/$/, '')}/email-change?token=${token}`,
      }).catch((err: unknown) => request.log.warn({ err }, 'email change link failed'))

      return reply.send({ message: `We sent a link to ${newEmail}. Open it to finish.` })
    },
  )

  // POST /api/auth/email-change/confirm — opened from the link sent to the
  // new address. Works signed out (the link may open on another device).
  // The old address is told, in case it wasn't the owner who asked.
  fastify.post(
    '/api/auth/email-change/confirm',
    {
      schema: {
        tags: ['auth'],
        response: openApiResponse(AuthMessageResponseSchema, 'AuthMessage'),
      },
    },
    async (request, reply) => {
      const parsed = ConfirmEmailChangeSchema.safeParse(request.body)
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid or expired link' })

      const change = await fastify.prisma.emailChange.findUnique({
        where: { token: parsed.data.token },
        include: {
          user: { select: { email: true, username: true, displayName: true, deletedAt: true } },
        },
      })
      if (!change || change.usedAt || change.expiresAt < new Date() || change.user.deletedAt) {
        return reply.status(400).send({ error: 'Invalid or expired link' })
      }
      const taken = await fastify.prisma.user.findFirst({
        where: {
          email: { equals: change.newEmail, mode: 'insensitive' },
          id: { not: change.userId },
        },
        select: { id: true },
      })
      if (taken) {
        return reply.status(409).send({ error: 'Another account uses that address now' })
      }

      const oldEmail = change.user.email
      await fastify.prisma.$transaction([
        fastify.prisma.user.update({
          where: { id: change.userId },
          data: { email: change.newEmail, emailVerifiedAt: new Date() },
        }),
        fastify.prisma.emailChange.update({
          where: { id: change.id },
          data: { usedAt: new Date() },
        }),
      ])
      // Newsletter subscriptions are kept by address; follow the account to
      // its new one, unless it already subscribed there to the same artist.
      const subs = await fastify.prisma.newsletterSubscriber.findMany({
        where: { email: { equals: oldEmail, mode: 'insensitive' } },
        select: { id: true, artistUserId: true },
      })
      for (const sub of subs) {
        const clash = await fastify.prisma.newsletterSubscriber.findUnique({
          where: {
            artistUserId_email: { artistUserId: sub.artistUserId, email: change.newEmail },
          },
          select: { id: true },
        })
        await (clash
          ? fastify.prisma.newsletterSubscriber.delete({ where: { id: sub.id } })
          : fastify.prisma.newsletterSubscriber.update({
              where: { id: sub.id },
              data: { email: change.newEmail },
            }))
      }
      await sendSecurityNotice(
        {
          to: oldEmail,
          displayName: safeDisplayName(change.user.displayName, change.user.username),
          subject: 'Your Tahti email address was changed',
          what: `Your Tahti account now uses ${change.newEmail}. Emails from Tahti go there from now on.`,
        },
        request.log,
      )

      return reply.send({ message: `Your account now uses ${change.newEmail}.` })
    },
  )
}

export default meEmailChangeRoutes
