// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AdminBetaApplicationListQuerySchema,
  AdminBetaApplicationListSchema,
  AdminBetaApproveResponseSchema,
  AdminBetaApproveSchema,
  AdminBetaRejectResponseSchema,
  AdminBetaResendSetupResponseSchema,
  BetaApplicationIdParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { config } from '../../config.js'
import { createArtistAccount } from '../../lib/create-artist-account.js'
import { sendBetaApprovedEmail } from '../../lib/email.js'
import { createPasswordSetupToken, findActivePasswordSetupToken } from '../../lib/password-setup.js'

function setupUrl(token: string) {
  return `${config.appUrl}/setup-password?token=${encodeURIComponent(token)}`
}

async function mapApplicationRow(
  app: {
    id: string
    name: string
    email: string
    artistType: string
    links: string | null
    message: string | null
    source: string
    status: string
    userId: string | null
    reviewedAt: Date | null
    createdAt: Date
    user: { username: string; passwordHash: string | null } | null
  },
  prisma: Parameters<typeof findActivePasswordSetupToken>[0],
) {
  const hasPassword = Boolean(app.user?.passwordHash)
  let setupToken: string | null = null
  if (app.userId && !hasPassword) {
    setupToken = await findActivePasswordSetupToken(prisma, app.userId)
  }

  return {
    id: app.id,
    name: app.name,
    email: app.email,
    artistType: app.artistType,
    links: app.links,
    message: app.message,
    source: app.source,
    status: app.status,
    userId: app.userId,
    username: app.user?.username ?? null,
    hasPassword,
    setupUrl: setupToken ? setupUrl(setupToken) : null,
    reviewedAt: app.reviewedAt,
    createdAt: app.createdAt,
  }
}

const adminBetaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/beta/applications',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminBetaApplicationListSchema, 'AdminBetaApplicationList'),
      },
    },
    async (request, reply) => {
      const parsed = AdminBetaApplicationListQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid query' })
      }

      const { status, limit } = parsed.data
      const applications = await fastify.prisma.betaApplication.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          user: { select: { username: true, passwordHash: true } },
        },
      })

      const rows = await Promise.all(
        applications.map((app) => mapApplicationRow(app, fastify.prisma)),
      )

      return reply.send({ applications: rows })
    },
  )

  fastify.post(
    '/api/admin/beta/applications/:id/approve',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminBetaApproveResponseSchema, 'AdminBetaApprove'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(BetaApplicationIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const body = AdminBetaApproveSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send({
          error: body.error.issues[0]?.message ?? 'Invalid request body',
        })
      }

      const application = await fastify.prisma.betaApplication.findUnique({
        where: { id },
      })
      if (!application) {
        return reply.status(404).send({ error: 'Application not found' })
      }
      if (application.status !== 'PENDING') {
        return reply.status(409).send({ error: 'Application is not pending' })
      }

      const existingUser = await fastify.prisma.user.findFirst({
        where: { OR: [{ email: application.email }, { username: body.data.username }] },
        select: { email: true, username: true },
      })
      if (existingUser) {
        const field = existingUser.email === application.email ? 'email' : 'username'
        return reply.status(409).send({ error: `${field} is already taken` })
      }

      const displayName = body.data.displayName?.trim() || application.name
      const reviewerId = request.sessionUser!.id

      const result = await fastify.prisma.$transaction(async (tx) => {
        const user = await createArtistAccount(tx, {
          email: application.email,
          username: body.data.username,
          displayName,
          passwordHash: null,
          emailVerifiedAt: new Date(),
          membershipStatus: 'PENDING_PAYMENT',
        })

        await tx.betaApplication.update({
          where: { id: application.id },
          data: {
            status: 'APPROVED',
            userId: user.id,
            reviewedAt: new Date(),
            reviewedById: reviewerId,
          },
        })

        return user
      })

      const token = await createPasswordSetupToken(fastify.prisma, result.id)
      const url = setupUrl(token)

      sendBetaApprovedEmail({
        to: result.email,
        displayName: result.displayName,
        setupUrl: url,
      }).catch((err: unknown) => fastify.log.error({ err }, 'beta approved email failed'))

      return reply.send({ ok: true as const, userId: result.id, setupUrl: url })
    },
  )

  fastify.post(
    '/api/admin/beta/applications/:id/reject',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminBetaRejectResponseSchema, 'AdminBetaReject'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(BetaApplicationIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const application = await fastify.prisma.betaApplication.findUnique({
        where: { id },
      })
      if (!application) {
        return reply.status(404).send({ error: 'Application not found' })
      }
      if (application.status !== 'PENDING') {
        return reply.status(409).send({ error: 'Application is not pending' })
      }

      await fastify.prisma.betaApplication.update({
        where: { id: application.id },
        data: {
          status: 'REJECTED',
          reviewedAt: new Date(),
          reviewedById: request.sessionUser!.id,
        },
      })

      return reply.send({ ok: true as const })
    },
  )

  fastify.post(
    '/api/admin/beta/applications/:id/resend-setup',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminBetaResendSetupResponseSchema, 'AdminBetaResendSetup'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(BetaApplicationIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const application = await fastify.prisma.betaApplication.findUnique({
        where: { id },
        include: {
          user: {
            select: { id: true, email: true, displayName: true, passwordHash: true },
          },
        },
      })
      if (!application) {
        return reply.status(404).send({ error: 'Application not found' })
      }
      if (application.status !== 'APPROVED' || !application.user) {
        return reply.status(409).send({ error: 'Application is not approved' })
      }
      if (application.user.passwordHash) {
        return reply.status(409).send({ error: 'User already has a password' })
      }

      const token = await createPasswordSetupToken(fastify.prisma, application.user.id)
      const url = setupUrl(token)

      sendBetaApprovedEmail({
        to: application.user.email,
        displayName: application.user.displayName,
        setupUrl: url,
      }).catch((err: unknown) => fastify.log.error({ err }, 'beta setup resend email failed'))

      return reply.send({ ok: true as const, setupUrl: url })
    },
  )
}

export default adminBetaRoutes
