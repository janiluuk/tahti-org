// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { UsernameParamSchema, parseRouteParams } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const artistFollowRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/v1/artists/:username/follow',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(UsernameParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { username } = routeParams

      const artist = await fastify.prisma.user.findUnique({
        where: { username },
        select: { id: true },
      })
      if (!artist) return reply.status(404).send({ error: 'Artist not found' })
      if (artist.id === user.id) {
        return reply.status(400).send({ error: 'Cannot follow yourself' })
      }

      await fastify.prisma.artistFollow.upsert({
        where: {
          followerUserId_artistUserId: { followerUserId: user.id, artistUserId: artist.id },
        },
        create: { followerUserId: user.id, artistUserId: artist.id },
        update: {},
      })

      return reply.send({ following: true })
    },
  )

  fastify.delete(
    '/api/v1/artists/:username/follow',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(UsernameParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { username } = routeParams

      const artist = await fastify.prisma.user.findUnique({
        where: { username },
        select: { id: true },
      })
      if (!artist) return reply.status(404).send({ error: 'Artist not found' })

      await fastify.prisma.artistFollow.deleteMany({
        where: { followerUserId: user.id, artistUserId: artist.id },
      })

      return reply.send({ following: false })
    },
  )

  fastify.get(
    '/api/v1/artists/:username/follow',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(UsernameParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { username } = routeParams

      const artist = await fastify.prisma.user.findUnique({
        where: { username },
        select: { id: true },
      })
      if (!artist) return reply.status(404).send({ error: 'Artist not found' })

      const follow = await fastify.prisma.artistFollow.findUnique({
        where: {
          followerUserId_artistUserId: { followerUserId: user.id, artistUserId: artist.id },
        },
      })

      return reply.send({ following: !!follow })
    },
  )
}

export default artistFollowRoutes
