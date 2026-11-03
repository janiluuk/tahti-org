// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { ChannelSoundParamsSchema, parseRouteParams } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const collaborativeRemoveRoutes: FastifyPluginAsync = async (fastify) => {
  // DELETE /api/v1/collections/:slug/items/:itemId — a guest on a
  // collaborative playlist takes back a track they added (Undo, or a
  // mistake). Only their own adds; the owner keeps the owner-only
  // /api/me/collections/:slug/items/:itemId for everything else.
  fastify.delete(
    '/api/v1/collections/:slug/items/:itemId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ChannelSoundParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug, itemId } = routeParams

      const item = await fastify.prisma.collectionItem.findFirst({
        where: { id: itemId, collection: { slug, collaborative: true } },
        select: { id: true, addedByUserId: true },
      })
      if (!item) return reply.status(404).send({ error: 'Item not found' })
      if (item.addedByUserId !== user.id) {
        return reply.status(403).send({ error: 'You can only remove tracks you added' })
      }

      await fastify.prisma.collectionItem.delete({ where: { id: item.id } })
      return reply.status(204).send()
    },
  )
}

export default collaborativeRemoveRoutes
