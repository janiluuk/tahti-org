// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AccountDeletionRequestSchema,
  AccountDeletionResponseSchema,
  PressKitSchema,
  UsernameParamSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { buildPressKit } from '../../lib/press-kit.js'

const mePrivacyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/press-kit.json',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M12: artist press kit JSON (includes contact email)',
        response: openApiResponse(PressKitSchema, 'PressKit'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const kit = await buildPressKit(fastify.prisma, user.username, { includeEmail: true })
      if (!kit) return reply.status(404).send({ error: 'Profile not found' })
      return reply.send(kit)
    },
  )

  fastify.get(
    '/api/me/data-export.json',
    {
      preHandler: requireAuth,
      schema: { tags: ['channel'], description: 'M19: GDPR data export for signed-in artist' },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const [profile, fanSubsAsArtist, fanSubsAsSubscriber, releases] = await Promise.all([
        fastify.prisma.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            email: true,
            username: true,
            displayName: true,
            bio: true,
            tier: true,
            isMember: true,
            memberSince: true,
            createdAt: true,
            socialLinks: true,
            channel: { select: { slug: true, state: true } },
          },
        }),
        fastify.prisma.fanSubscription.findMany({
          where: { artistUserId: user.id },
          select: {
            tierName: true,
            amountCents: true,
            state: true,
            startedAt: true,
            subscriber: { select: { username: true } },
          },
        }),
        fastify.prisma.fanSubscription.findMany({
          where: { subscriberUserId: user.id },
          select: {
            tierName: true,
            amountCents: true,
            state: true,
            artist: { select: { username: true } },
          },
        }),
        fastify.prisma.release.findMany({
          where: { userId: user.id },
          select: { title: true, state: true, smartLinkSlug: true, releaseDate: true },
        }),
      ])

      return reply.send({
        exportedAt: new Date().toISOString(),
        profile,
        fanSubscriptionsAsArtist: fanSubsAsArtist,
        fanSubscriptionsAsSubscriber: fanSubsAsSubscriber,
        releases,
      })
    },
  )

  fastify.post(
    '/api/me/account/deletion-request',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M19: request account deletion (creates support ticket for board review)',
        response: openApiResponses([
          { status: 200, schema: AccountDeletionResponseSchema, name: 'AccountDeletionResponse' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = AccountDeletionRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }

      const existing = await fastify.prisma.supportTicket.findFirst({
        where: {
          artistId: user.id,
          category: 'OTHER',
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          subject: 'Account deletion request',
        },
      })
      if (existing) {
        return reply.send({ ok: true as const, ticketId: existing.id.toString() })
      }

      const ticket = await fastify.prisma.supportTicket.create({
        data: {
          artistId: user.id,
          subject: 'Account deletion request',
          message: parsed.data.reason,
          category: 'OTHER',
        },
      })

      return reply.send({ ok: true as const, ticketId: ticket.id.toString() })
    },
  )
}

export default mePrivacyRoutes

const publicPressKitRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/u/:username/press-kit.json',
    {
      schema: {
        tags: ['releases'],
        description: 'M12: public press kit JSON for promoters and press',
        response: openApiResponse(PressKitSchema, 'PressKit'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(UsernameParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const kit = await buildPressKit(fastify.prisma, routeParams.username)
      if (!kit) return reply.status(404).send({ error: 'Artist not found' })
      return reply.send(kit)
    },
  )
}

export { publicPressKitRoutes }
