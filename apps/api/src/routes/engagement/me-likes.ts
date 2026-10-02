// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { MeLikesQuerySchema, MeLikesResponseSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { listLikedTracks } from '../../lib/liked-tracks.js'

const meLikesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/likes — tracks you liked, newest first. Public, finished
  // tracks only (plus your own), each with a gated playback link.
  fastify.get(
    '/api/me/likes',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['engagement'],
        description: 'The tracks you liked, newest first',
        response: openApiResponse(MeLikesResponseSchema, 'MeLikes'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const query = MeLikesQuerySchema.safeParse(request.query ?? {})
      if (!query.success) return reply.status(400).send({ error: 'Invalid query' })

      const items = await listLikedTracks(fastify.prisma, {
        likerUserId: user.id,
        viewerUserId: user.id,
        soundWhere: {
          status: 'READY',
          OR: [{ isPublic: true }, { channel: { userId: user.id } }],
        },
        limit: query.data.limit,
      })

      return reply.send({ items })
    },
  )
}

export default meLikesRoutes
