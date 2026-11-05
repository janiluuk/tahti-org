// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { SlugParamSchema, parseRouteParams } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { availableUserWhere } from '../../lib/listed-artist.js'
import { loadGroupForUser, publicUser } from './helpers.js'

const MEMBER_LIST_LIMIT = 500
const ROLE_ORDER = { OWNER: 0, ADMIN: 1, MEMBER: 2 } as const

const groupMemberRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/groups/:slug/members — every member, owner and admins first.
  // Only members see the full list; the public page shows a short preview.
  fastify.get(
    '/api/me/groups/:slug/members',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const loaded = await loadGroupForUser(fastify, routeParams.slug, user.id)
      if (!loaded || !loaded.role) return reply.status(404).send({ error: 'Group not found' })

      const where = { groupId: loaded.group.id, user: availableUserWhere }
      const [members, total] = await Promise.all([
        fastify.prisma.artistGroupMember.findMany({
          where,
          orderBy: { joinedAt: 'asc' },
          take: MEMBER_LIST_LIMIT,
          select: {
            role: true,
            joinedAt: true,
            user: { select: { username: true, displayName: true, avatarUrl: true } },
          },
        }),
        fastify.prisma.artistGroupMember.count({ where }),
      ])
      const items = members
        .map((m) => ({
          ...publicUser(m.user),
          avatarUrl: m.user.avatarUrl,
          role: m.role,
          joinedAt: m.joinedAt,
        }))
        .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])
      return reply.send({ items, total })
    },
  )
}

export default groupMemberRoutes
