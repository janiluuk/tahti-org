// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'

// M22 — username autocomplete for tracklist @tags
const meUsersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/me/users/search', { preHandler: requireAuth }, async (request, reply) => {
    const q = ((request.query as { q?: string }).q ?? '').trim().toLowerCase()
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
  })
}

export default meUsersRoutes
