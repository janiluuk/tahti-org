// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  MeCollectionSubscriptionsResponseSchema,
  openApiResponse,
  safeDisplayName,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { resolveCollectionCoverUrl } from '../../lib/collection-cover.js'
import { linkReachableCollectionWhere } from './helpers.js'

const SUBSCRIPTIONS_LIMIT = 200

export const collectionSubscriptionRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/collection-subscriptions — collections you subscribed to,
  // newest first, while you can still open them (public or unlisted).
  fastify.get(
    '/api/me/collection-subscriptions',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['collections'],
        description: 'Collections you subscribed to',
        response: openApiResponse(
          MeCollectionSubscriptionsResponseSchema,
          'MeCollectionSubscriptions',
        ),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const rows = await fastify.prisma.collectionSubscription.findMany({
        where: { userId: user.id, collection: linkReachableCollectionWhere },
        orderBy: { createdAt: 'desc' },
        take: SUBSCRIPTIONS_LIMIT,
        select: {
          createdAt: true,
          collection: {
            select: {
              slug: true,
              name: true,
              type: true,
              coverUrl: true,
              coverKey: true,
              _count: { select: { items: true } },
              user: { select: { username: true, displayName: true } },
            },
          },
        },
      })

      const items = await Promise.all(
        rows.map(async ({ createdAt, collection }) => ({
          slug: collection.slug,
          name: collection.name,
          type: collection.type,
          coverUrl: await resolveCollectionCoverUrl(collection),
          itemCount: collection._count.items,
          ownerUsername: collection.user.username,
          ownerDisplayName: safeDisplayName(collection.user.displayName, collection.user.username),
          subscribedAt: createdAt.toISOString(),
        })),
      )

      return reply.send({ items })
    },
  )
}
