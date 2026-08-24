// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ArtistFollowListResponseSchema,
  ArtistFollowResponseSchema,
  UsernameParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { notifyArtistOfNewFollower } from '@tahti/db'
import { requireAuth } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'

const FOLLOW_LIST_PAGE_SIZE = 30

const artistFollowRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/v1/artists/:username/follow',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['engagement'],
        response: openApiResponse(ArtistFollowResponseSchema, 'ArtistFollow'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(UsernameParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { username } = routeParams

      const artist = await fastify.prisma.user.findUnique({
        where: { username },
        select: { id: true, username: true, displayName: true },
      })
      if (!artist) return reply.status(404).send({ error: 'Artist not found' })
      if (artist.id === user.id) {
        return reply.status(400).send({ error: 'Cannot follow yourself' })
      }

      const { didCreate } = await fastify.prisma.$transaction(async (tx) => {
        const existing = await tx.artistFollow.findUnique({
          where: {
            followerUserId_artistUserId: { followerUserId: user.id, artistUserId: artist.id },
          },
          select: { followerUserId: true },
        })
        if (existing) return { didCreate: false }
        await tx.artistFollow.create({
          data: { followerUserId: user.id, artistUserId: artist.id },
        })
        return { didCreate: true }
      })

      if (didCreate) {
        await notifyArtistOfNewFollower(fastify.prisma, artist.id, user).catch((e) =>
          fastify.log.warn(e, 'new-follower notification failed'),
        )
        await auditLog(fastify.prisma, {
          action: 'ARTIST_FOLLOW',
          actorId: user.id,
          targetId: artist.id,
          meta: { artistUsername: artist.username, artistDisplayName: artist.displayName },
        })
      }

      const followerCount = await fastify.prisma.artistFollow.count({
        where: { artistUserId: artist.id },
      })

      return reply.send({ following: true, followerCount })
    },
  )

  fastify.delete(
    '/api/v1/artists/:username/follow',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['engagement'],
        response: openApiResponse(ArtistFollowResponseSchema, 'ArtistFollow'),
      },
    },
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

      const followerCount = await fastify.prisma.artistFollow.count({
        where: { artistUserId: artist.id },
      })

      return reply.send({ following: false, followerCount })
    },
  )

  // GET is intentionally not auth-gated — the follower count is public (shown to
  // anonymous visitors on the channel/profile page); `following` just reports
  // false when there's no session instead of 401ing the whole page.
  fastify.get(
    '/api/v1/artists/:username/follow',
    {
      schema: {
        tags: ['engagement'],
        response: openApiResponse(ArtistFollowResponseSchema, 'ArtistFollow'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser
      const routeParams = parseRouteParams(UsernameParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { username } = routeParams

      const artist = await fastify.prisma.user.findUnique({
        where: { username },
        select: { id: true },
      })
      if (!artist) return reply.status(404).send({ error: 'Artist not found' })

      const [follow, followerCount] = await Promise.all([
        user
          ? fastify.prisma.artistFollow.findUnique({
              where: {
                followerUserId_artistUserId: { followerUserId: user.id, artistUserId: artist.id },
              },
            })
          : null,
        fastify.prisma.artistFollow.count({ where: { artistUserId: artist.id } }),
      ])

      return reply.send({ following: !!follow, followerCount })
    },
  )

  // Followers/following list modals — gated by the artist's own showFollowers/
  // showFollowing toggle, EXCEPT for the artist viewing their own profile (the
  // settings preview should be honest about what's actually configured, but an
  // artist can always see their own lists).
  function registerFollowListRoute(
    direction: 'followers' | 'following',
    visibilityField: 'showFollowers' | 'showFollowing',
  ) {
    fastify.get(
      `/api/v1/artists/:username/${direction}`,
      {
        schema: {
          tags: ['engagement'],
          response: openApiResponse(ArtistFollowListResponseSchema, 'ArtistFollowList'),
        },
      },
      async (request, reply) => {
        const routeParams = parseRouteParams(UsernameParamSchema, request.params)
        if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
        const { username } = routeParams
        const { offset: offsetRaw } = request.query as { offset?: string }
        const offset = Math.max(0, parseInt(offsetRaw ?? '0', 10) || 0)

        const artist = await fastify.prisma.user.findUnique({
          where: { username },
          select: { id: true, showFollowers: true, showFollowing: true },
        })
        if (!artist) return reply.status(404).send({ error: 'Artist not found' })

        const viewer = request.sessionUser
        const isOwner = viewer?.id === artist.id
        if (!isOwner && !artist[visibilityField]) {
          return reply.send({ users: [], hasMore: false })
        }

        const where =
          direction === 'followers' ? { artistUserId: artist.id } : { followerUserId: artist.id }
        const rows = await fastify.prisma.artistFollow.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: FOLLOW_LIST_PAGE_SIZE + 1,
          select: {
            follower:
              direction === 'followers'
                ? { select: { username: true, displayName: true, avatarUrl: true } }
                : undefined,
            artist:
              direction === 'following'
                ? { select: { username: true, displayName: true, avatarUrl: true } }
                : undefined,
          },
        })

        const hasMore = rows.length > FOLLOW_LIST_PAGE_SIZE
        const page = rows.slice(0, FOLLOW_LIST_PAGE_SIZE)
        const users = page.map((row) => (direction === 'followers' ? row.follower! : row.artist!))

        return reply.send({ users, hasMore })
      },
    )
  }

  registerFollowListRoute('followers', 'showFollowers')
  registerFollowListRoute('following', 'showFollowing')
}

export default artistFollowRoutes
