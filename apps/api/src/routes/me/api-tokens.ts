// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ApiTokenCreatedSchema,
  ApiTokenListSchema,
  CreateApiTokenSchema,
  IdParamSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { generateApiToken } from '../../lib/api-token.js'
import { auditLog } from '../../lib/audit.js'

const MAX_TOKENS_PER_USER = 20

const apiTokenRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/api-tokens — list this user's tokens (never includes the secret)
  fastify.get(
    '/api/me/api-tokens',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['settings'],
        summary: 'List your personal API tokens',
        response: openApiResponse(ApiTokenListSchema, 'ApiTokenList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const tokens = await fastify.prisma.apiToken.findMany({
        where: { userId: user.id, revokedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          tokenPrefix: true,
          scopes: true,
          lastUsedAt: true,
          expiresAt: true,
          createdAt: true,
        },
      })
      return reply.send(tokens)
    },
  )

  // POST /api/me/api-tokens — mint a new token; the plaintext value is only ever in this response
  fastify.post(
    '/api/me/api-tokens',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['settings'],
        summary: 'Create a personal API token',
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 64 },
            scopes: { type: 'array', items: { type: 'string', enum: ['read', 'write'] } },
            expiresInDays: { type: 'integer', minimum: 1, maximum: 3650 },
          },
          required: ['name'],
        },
        response: openApiResponses([
          { status: 201, schema: ApiTokenCreatedSchema, name: 'ApiTokenCreated' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = CreateApiTokenSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const body = parsed.data

      const activeCount = await fastify.prisma.apiToken.count({
        where: { userId: user.id, revokedAt: null },
      })
      if (activeCount >= MAX_TOKENS_PER_USER) {
        return reply.status(400).send({ error: `Maximum ${MAX_TOKENS_PER_USER} active tokens` })
      }

      const generated = generateApiToken()
      const expiresAt = body.expiresInDays
        ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
        : null

      const created = await fastify.prisma.apiToken.create({
        data: {
          userId: user.id,
          name: body.name,
          tokenHash: generated.tokenHash,
          tokenPrefix: generated.tokenPrefix,
          scopes: body.scopes ?? ['read'],
          expiresAt,
        },
        select: {
          id: true,
          name: true,
          tokenPrefix: true,
          scopes: true,
          lastUsedAt: true,
          expiresAt: true,
          createdAt: true,
        },
      })

      await auditLog(fastify.prisma, {
        action: 'API_TOKEN_CREATE',
        actorId: user.id,
        targetId: created.id,
        meta: { name: body.name, scopes: created.scopes },
      })

      return reply.status(201).send({ ...created, token: generated.token })
    },
  )

  // DELETE /api/me/api-tokens/:id — revoke (soft-delete, keeps the audit trail)
  fastify.delete('/api/me/api-tokens/:id', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const routeParams = parseRouteParams(IdParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const { id } = routeParams

    const token = await fastify.prisma.apiToken.findFirst({
      where: { id, userId: user.id, revokedAt: null },
    })
    if (!token) return reply.status(404).send({ error: 'Token not found' })

    await fastify.prisma.apiToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    })

    await auditLog(fastify.prisma, {
      action: 'API_TOKEN_REVOKE',
      actorId: user.id,
      targetId: id,
      meta: { name: token.name },
    })

    return reply.status(204).send()
  })
}

export default apiTokenRoutes
