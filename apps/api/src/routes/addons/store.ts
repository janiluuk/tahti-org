// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Store browsing for the two self-service scopes. The ADMIN store lives
// behind GET /api/admin/addons (requireBoard) instead — a listener or
// artist session can never reach ADMIN-scope widgets through this route.

import type { FastifyPluginAsync } from 'fastify'
import { AddonStoreListSchema, AddonStoreQuerySchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const STORE_ITEM_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  authorName: true,
  categories: true,
  iconUrl: true,
  currentVersion: true,
} as const

const addonStoreRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/addons/store',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['addons'],
        response: openApiResponse(AddonStoreListSchema, 'AddonStoreList'),
      },
    },
    async (request, reply) => {
      const parsed = AddonStoreQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid query' })
      }
      const { scope, category } = parsed.data

      if (scope === 'ARTIST') {
        const channel = await fastify.prisma.channel.findUnique({
          where: { userId: request.sessionUser!.id },
          select: { id: true },
        })
        if (!channel) return reply.status(403).send({ error: 'Artists only' })
      }

      const widgets = await fastify.prisma.addon.findMany({
        where: {
          scope,
          status: 'APPROVED',
          ...(category ? { categories: { has: category } } : {}),
        },
        orderBy: { name: 'asc' },
        select: STORE_ITEM_SELECT,
      })
      return reply.send({ widgets })
    },
  )
}

export default addonStoreRoutes
