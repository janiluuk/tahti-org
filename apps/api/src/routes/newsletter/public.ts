// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { nanoid } from 'nanoid'
import { NewsletterSubscribeSchema } from '@tahti/shared'
import { sendMail } from '../../lib/email.js'
import { config } from '../../config.js'

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

// M13 — public newsletter subscription endpoints (no auth required)
const newsletterPublicRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/newsletter/subscribe — listener subscribes to an artist
  fastify.post('/api/newsletter/subscribe', async (request, reply) => {
    const parsed = NewsletterSubscribeSchema.safeParse(request.body)
    if (!parsed.success) return zodError(reply, parsed.error)
    const email = parsed.data.email.toLowerCase()
    const artistUsername = parsed.data.artistUsername

    const artist = await fastify.prisma.user.findUnique({
      where: { username: artistUsername },
      select: { id: true, displayName: true },
    })
    if (!artist) return reply.status(404).send({ error: 'Artist not found' })

    const existing = await fastify.prisma.newsletterSubscriber.findUnique({
      where: { artistUserId_email: { artistUserId: artist.id, email } },
    })

    if (existing?.confirmedAt && !existing.unsubscribedAt) {
      return reply.send({ status: 'already_subscribed' })
    }

    const confirmToken = nanoid(32)
    const unsubToken = existing?.unsubToken ?? nanoid(32)

    await fastify.prisma.newsletterSubscriber.upsert({
      where: { artistUserId_email: { artistUserId: artist.id, email } },
      create: {
        artistUserId: artist.id,
        email,
        confirmToken,
        unsubToken,
      },
      update: {
        confirmToken,
        unsubscribedAt: null,
      },
    })

    const confirmUrl = `${config.apiUrl}/api/newsletter/confirm/${confirmToken}`
    await sendMail({
      to: email,
      subject: `Confirm your subscription to ${artist.displayName}`,
      text: `Click to confirm: ${confirmUrl}\n\nIf you didn't subscribe, ignore this email.`,
    })

    return reply.send({ status: 'confirmation_sent' })
  })

  // GET /api/newsletter/confirm/:token — double opt-in confirmation
  fastify.get('/api/newsletter/confirm/:token', async (request, reply) => {
    const { token } = request.params as { token: string }

    const sub = await fastify.prisma.newsletterSubscriber.findUnique({
      where: { confirmToken: token },
    })

    if (!sub) return reply.status(404).send({ error: 'Invalid or expired confirmation link' })

    await fastify.prisma.newsletterSubscriber.update({
      where: { id: sub.id },
      data: { confirmedAt: new Date(), confirmToken: null },
    })

    return reply.redirect(`${config.appUrl}/newsletter/confirmed`)
  })

  // GET /api/newsletter/unsubscribe/:token — one-click unsubscribe
  fastify.get('/api/newsletter/unsubscribe/:token', async (request, reply) => {
    const { token } = request.params as { token: string }

    const sub = await fastify.prisma.newsletterSubscriber.findUnique({
      where: { unsubToken: token },
    })

    if (!sub) return reply.status(404).send({ error: 'Invalid unsubscribe link' })

    await fastify.prisma.newsletterSubscriber.update({
      where: { id: sub.id },
      data: { unsubscribedAt: new Date() },
    })

    return reply.redirect(`${config.appUrl}/newsletter/unsubscribed`)
  })
}

export default newsletterPublicRoutes
