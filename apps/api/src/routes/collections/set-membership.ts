// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  SetMembershipResponseSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { resolveCollectionCoverUrl } from '../../lib/collection-cover.js'
import { publicCollectionSoundWhere } from './helpers.js'

const SET_MEMBERSHIP_TAKE = 500

const setMembershipRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/sound/:id/set-membership — every collection the caller owns
  // that can take this sound, flagged with whether it is already in it. The
  // "add to set" picker reads this; adding and removing reuse the existing
  // /api/me/collections/:slug/items routes (`itemId` is the item to delete).
  // Group playlists are left out: their adds go through the group's rules.
  fastify.get(
    '/api/me/sound/:id/set-membership',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        description: 'Collections the caller manages, with whether this sound is in each',
        response: openApiResponse(SetMembershipResponseSchema, 'SetMembership'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const sound = await fastify.prisma.sound.findFirst({
        where: { id, OR: [{ channel: { userId: user.id } }, publicCollectionSoundWhere] },
        select: { id: true },
      })
      if (!sound) return reply.status(404).send({ error: 'Sound item not found' })

      const collections = await fastify.prisma.collection.findMany({
        where: { userId: user.id, artistGroup: null },
        orderBy: { createdAt: 'desc' },
        take: SET_MEMBERSHIP_TAKE,
        select: {
          id: true,
          slug: true,
          name: true,
          coverUrl: true,
          coverKey: true,
          style: true,
          isPublic: true,
          visibility: true,
          items: { where: { soundId: id }, select: { id: true }, take: 1 },
          _count: { select: { items: true } },
        },
      })

      return reply.send(
        await Promise.all(
          collections.map(async (col) => ({
            id: col.id,
            slug: col.slug,
            name: col.name,
            coverUrl: await resolveCollectionCoverUrl(col),
            style: col.style,
            isPublic: col.isPublic,
            visibility: col.visibility,
            itemCount: col._count.items,
            member: col.items.length > 0,
            itemId: col.items[0]?.id ?? null,
          })),
        ),
      )
    },
  )
}

export default setMembershipRoutes
