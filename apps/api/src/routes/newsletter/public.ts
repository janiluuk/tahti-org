// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { availableUserWhere } from '@tahti/db'
import { nanoid } from 'nanoid'
import {
  NewsletterSubscribeSchema,
  NewsletterSubscribeStatusSchema,
  TokenParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { sendMail } from '../../lib/email.js'
import { config } from '../../config.js'
import { userName } from '../../lib/safe-names.js'

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

// M13 — public newsletter subscription endpoints (no auth required)
const newsletterPublicRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/newsletter/subscribe — listener subscribes to an artist
  fastify.post(
    '/api/newsletter/subscribe',
    {
      schema: {
        tags: ['newsletter'],
        response: openApiResponse(NewsletterSubscribeStatusSchema, 'NewsletterSubscribeStatus'),
      },
    },
    async (request, reply) => {
      const parsed = NewsletterSubscribeSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const email = parsed.data.email.toLowerCase()
      const artistUsername = parsed.data.artistUsername

      const artist = await fastify.prisma.user.findFirst({
        where: { username: artistUsername, ...availableUserWhere },
        select: { id: true, username: true, displayName: true },
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
        // Someone who unsubscribed has to confirm again: without this, anyone
        // who knows the address could put it back on the list.
        update: {
          confirmToken,
          unsubscribedAt: null,
          ...(existing?.unsubscribedAt ? { confirmedAt: null } : {}),
        },
      })

      const confirmUrl = `${config.apiUrl}/api/newsletter/confirm/${confirmToken}`
      await sendMail({
        to: email,
        subject: `Confirm your subscription to ${userName(artist)}`,
        text: `Click to confirm: ${confirmUrl}\n\nIf you didn't subscribe, ignore this email.`,
      })

      return reply.send({ status: 'confirmation_sent' })
    },
  )

  // GET /api/newsletter/confirm/:token — double opt-in confirmation
  fastify.get('/api/newsletter/confirm/:token', async (request, reply) => {
    const routeParams = parseRouteParams(TokenParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const { token } = routeParams

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
    const routeParams = parseRouteParams(TokenParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const { token } = routeParams

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

  // POST /api/newsletter/unsubscribe/:token — RFC 8058 one-click unsubscribe.
  // Mail providers send this themselves when someone presses their Unsubscribe
  // button, so it answers 200 with no redirect and is safe to repeat.
  fastify.post('/api/newsletter/unsubscribe/:token', async (request, reply) => {
    const routeParams = parseRouteParams(TokenParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

    const { count } = await fastify.prisma.newsletterSubscriber.updateMany({
      where: { unsubToken: routeParams.token, unsubscribedAt: null },
      data: { unsubscribedAt: new Date() },
    })
    if (count === 0) {
      const known = await fastify.prisma.newsletterSubscriber.findUnique({
        where: { unsubToken: routeParams.token },
        select: { id: true },
      })
      if (!known) return reply.status(404).send({ error: 'Invalid unsubscribe link' })
    }
    return reply.send({ ok: true })
  })
}

export default newsletterPublicRoutes
