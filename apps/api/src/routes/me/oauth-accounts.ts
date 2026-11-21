// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  OAuthAccountsResponseSchema,
  openApiNoContentResponse,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth, requireSession } from '../../plugins/auth.js'
import { isOAuthLoginProvider } from '../../lib/oauth-login/providers.js'

const meOAuthAccountsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/oauth-accounts',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['auth'],
        summary: 'Linked social sign-in accounts',
        response: openApiResponse(OAuthAccountsResponseSchema, 'OAuthAccounts'),
      },
    },
    async (request) => {
      const rows = await fastify.prisma.oAuthAccount.findMany({
        where: { userId: request.sessionUser!.id },
        orderBy: { createdAt: 'asc' },
        select: { provider: true, email: true, createdAt: true },
      })
      return {
        accounts: rows
          .filter((row) => isOAuthLoginProvider(row.provider))
          .map((row) => ({
            provider: row.provider,
            email: row.email,
            linkedAt: row.createdAt.toISOString(),
          })),
      }
    },
  )

  fastify.delete<{ Params: { provider: string } }>(
    '/api/me/oauth-accounts/:provider',
    {
      preHandler: requireSession,
      schema: {
        tags: ['auth'],
        summary: 'Unlink a social sign-in account',
        description:
          '204 on success. 409 when it is the last way to sign in (no password and no other linked provider).',
        response: openApiNoContentResponse(204),
      },
    },
    async (request, reply) => {
      const { provider } = request.params
      const userId = request.sessionUser!.id
      if (!isOAuthLoginProvider(provider)) {
        return reply.status(404).send({ error: 'Unknown sign-in provider' })
      }

      const [user, accounts] = await Promise.all([
        fastify.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } }),
        fastify.prisma.oAuthAccount.findMany({ where: { userId }, select: { provider: true } }),
      ])
      if (!accounts.some((a) => a.provider === provider)) {
        return reply.status(404).send({ error: 'That account is not linked' })
      }
      const otherLogins = accounts.filter((a) => a.provider !== provider).length
      if (!user?.passwordHash && otherLogins === 0) {
        return reply.status(409).send({
          error: 'Set a password or link another sign-in method before removing this one',
        })
      }

      await fastify.prisma.oAuthAccount.deleteMany({ where: { userId, provider } })
      return reply.status(204).send()
    },
  )
}

export default meOAuthAccountsRoutes
