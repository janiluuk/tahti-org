// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { ReorderCollectionSchema, SlugParamSchema, parseRouteParams } from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'
import {
  applyCollectionOrder,
  collectionItemInclude,
  safeUser,
  withSafeNames,
  withTrackNumbers,
  zodError,
} from '../collections/helpers.js'

// Board access to any collection's track order. Same body and response as the
// owner's PUT /api/me/collections/:slug/reorder, scoped by slug alone.
const adminCollectionRoutes: FastifyPluginAsync = async (fastify) => {
  async function orderedItems(collectionId: string) {
    const items = await fastify.prisma.collectionItem.findMany({
      where: { collectionId },
      orderBy: { position: 'asc' },
      include: collectionItemInclude,
    })
    return withTrackNumbers(items.map((item) => withSafeNames(item)))
  }

  fastify.get(
    '/api/admin/collections/:slug',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description:
          'Board view of any collection with every item (private ones too) in track order',
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const col = await fastify.prisma.collection.findUnique({
        where: { slug: routeParams.slug },
        select: {
          id: true,
          slug: true,
          name: true,
          style: true,
          trackSortMode: true,
          visibility: true,
          user: { select: { username: true, displayName: true } },
        },
      })
      if (!col) return reply.status(404).send({ error: 'Collection not found' })

      const { user, ...rest } = col
      return reply.send({ ...rest, owner: safeUser(user), items: await orderedItems(col.id) })
    },
  )

  fastify.put(
    '/api/admin/collections/:slug/reorder',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description:
          "Board reorder of any collection's tracks; itemIds lists every item, first track first",
      },
    },
    async (request, reply) => {
      const actor = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = ReorderCollectionSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const col = await fastify.prisma.collection.findUnique({
        where: { slug: routeParams.slug },
        select: { id: true, slug: true, userId: true },
      })
      if (!col) return reply.status(404).send({ error: 'Collection not found' })

      if (!(await applyCollectionOrder(fastify.prisma, col.id, parsed.data.itemIds))) {
        return reply.status(400).send({ error: 'itemIds must match collection items exactly' })
      }

      await auditLog(fastify.prisma, {
        action: 'COLLECTION_ADMIN_REORDER',
        actorId: actor.id,
        targetId: col.id,
        meta: { slug: col.slug, ownerId: col.userId, itemIds: parsed.data.itemIds },
      })

      return reply.send({ items: await orderedItems(col.id) })
    },
  )
}

export default adminCollectionRoutes
