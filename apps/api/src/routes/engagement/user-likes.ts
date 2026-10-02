// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@tahti/db'
import {
  LikedPlaylistResponseSchema,
  MeLikesQuerySchema,
  UsernameParamSchema,
  openApiResponse,
  parseRouteParams,
  safeDisplayName,
} from '@tahti/shared'
import { listLikedTracks } from '../../lib/liked-tracks.js'
import { listedArtistSoundWhere } from '../../lib/listed-artist.js'

const userLikesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/u/:username/likes — tracks this user liked, newest first,
  // only when they turned on "show likes". A hidden list still answers 200
  // with showLikes: false so the client can tell "private" from "empty"; the
  // account itself is already public through its profile, so a 404 would hide
  // nothing.
  fastify.get(
    '/api/v1/u/:username/likes',
    {
      schema: {
        tags: ['engagement'],
        description: "Public: a user's liked tracks, when they chose to show them",
        response: openApiResponse(LikedPlaylistResponseSchema, 'UserLikes'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(UsernameParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const query = MeLikesQuerySchema.safeParse(request.query ?? {})
      if (!query.success) return reply.status(400).send({ error: 'Invalid query' })

      const user = await fastify.prisma.user.findFirst({
        where: { username: routeParams.username, deletedAt: null, suspendedAt: null },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          showLikes: true,
        },
      })
      if (!user) return reply.status(404).send({ error: 'User not found' })

      const owner = {
        username: user.username,
        displayName: safeDisplayName(user.displayName, user.username),
        avatarUrl: user.avatarUrl,
      }
      if (!user.showLikes) {
        return reply.send({ owner, showLikes: false, itemCount: 0, coverUrl: null, items: [] })
      }

      const soundWhere: Prisma.SoundWhereInput = {
        status: 'READY',
        isPublic: true,
        ...listedArtistSoundWhere,
      }
      const [items, itemCount] = await Promise.all([
        listLikedTracks(fastify.prisma, {
          likerUserId: user.id,
          viewerUserId: request.sessionUser?.id ?? null,
          soundWhere,
          limit: query.data.limit,
        }),
        fastify.prisma.soundLike.count({ where: { userId: user.id, sound: soundWhere } }),
      ])

      return reply.send({
        owner,
        showLikes: true,
        itemCount,
        coverUrl: items.find((i) => i.bannerUrl)?.bannerUrl ?? null,
        items,
      })
    },
  )
}

export default userLikesRoutes
