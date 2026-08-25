// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AccountRestrictionListSchema,
  CreateAccountRestrictionSchema,
  IdParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'

const adminAccountRestrictionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/users/:id/restrictions',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AccountRestrictionListSchema, 'AccountRestrictionList'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const restrictions = await fastify.prisma.accountRestriction.findMany({
        where: { userId: routeParams.id },
        orderBy: { bannedAt: 'desc' },
        include: { bannedBy: { select: { username: true } } },
      })

      return reply.send({
        restrictions: restrictions.map((r) => ({
          id: r.id,
          type: r.type,
          reason: r.reason,
          bannedAt: r.bannedAt.toISOString(),
          expiresAt: r.expiresAt?.toISOString() ?? null,
          liftedAt: r.liftedAt?.toISOString() ?? null,
          bannedByUsername: r.bannedBy?.username ?? null,
        })),
      })
    },
  )

  fastify.post(
    '/api/admin/users/:id/restrictions',
    { preHandler: requireBoard },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = CreateAccountRestrictionSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message })
      }

      const targetUser = await fastify.prisma.user.findUnique({ where: { id: routeParams.id } })
      if (!targetUser) return reply.status(404).send({ error: 'User not found' })

      const expiresAt = parsed.data.durationDays
        ? new Date(Date.now() + parsed.data.durationDays * 86_400_000)
        : null

      const restriction = await fastify.prisma.accountRestriction.create({
        data: {
          userId: routeParams.id,
          type: parsed.data.type,
          reason: parsed.data.reason,
          expiresAt,
          bannedById: request.sessionUser!.id,
        },
      })

      return reply.status(201).send({
        id: restriction.id,
        type: restriction.type,
        reason: restriction.reason,
        bannedAt: restriction.bannedAt.toISOString(),
        expiresAt: restriction.expiresAt?.toISOString() ?? null,
        liftedAt: null,
        bannedByUsername: null,
      })
    },
  )

  fastify.delete(
    '/api/admin/users/:id/restrictions/:restrictionId',
    { preHandler: requireBoard },
    async (request, reply) => {
      const { id: userId, restrictionId } = request.params as {
        id: string
        restrictionId: string
      }

      const existing = await fastify.prisma.accountRestriction.findFirst({
        where: { id: restrictionId, userId },
      })
      if (!existing) return reply.status(404).send({ error: 'Restriction not found' })
      if (existing.liftedAt) return reply.send({ ok: true })

      await fastify.prisma.accountRestriction.update({
        where: { id: existing.id },
        data: { liftedAt: new Date() },
      })
      return reply.send({ ok: true })
    },
  )
}

export default adminAccountRestrictionRoutes
