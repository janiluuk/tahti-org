// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { UserSearchListSchema, UserSearchQuerySchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

// M22 — username autocomplete for tracklist @tags
const meUsersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/users/search',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(UserSearchListSchema, 'UserSearchList'),
      },
    },
    async (request, reply) => {
      const parsed = UserSearchQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid query',
        })
      }
      const q = (parsed.data.q ?? '').trim().toLowerCase()
      if (q.length < 2) return reply.send([])

      const users = await fastify.prisma.user.findMany({
        where: {
          username: { contains: q, mode: 'insensitive' },
          channel: { isNot: null },
        },
        take: 8,
        orderBy: { username: 'asc' },
        select: { username: true, displayName: true },
      })

      return reply.send(users)
    },
  )
}

export default meUsersRoutes
