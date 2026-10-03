// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  REPOSTED_TRACKS_LIMIT,
  UserRepostsResponseSchema,
  UsernameParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { resolveChannelUrl } from '../../lib/channel-url.js'
import { userName } from '../../lib/safe-names.js'

const userRepostsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/u/:username/reposts — tracks this user reposted, newest first.
  // Only READY, public sounds; no audio URL, so access gates don't apply here.
  fastify.get(
    '/api/v1/u/:username/reposts',
    {
      schema: {
        tags: ['engagement'],
        description: 'Public: the latest tracks a user reposted',
        response: openApiResponse(UserRepostsResponseSchema, 'UserReposts'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(UsernameParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const user = await fastify.prisma.user.findUnique({
        where: { username: routeParams.username },
        select: { id: true },
      })
      if (!user) return reply.status(404).send({ error: 'User not found' })

      const reposts = await fastify.prisma.soundRepost.findMany({
        where: { userId: user.id, sound: { status: 'READY', isPublic: true } },
        orderBy: { createdAt: 'desc' },
        take: REPOSTED_TRACKS_LIMIT,
        select: {
          createdAt: true,
          sound: {
            select: {
              id: true,
              title: true,
              bannerUrl: true,
              channel: {
                select: {
                  slug: true,
                  user: { select: { username: true, displayName: true } },
                },
              },
            },
          },
        },
      })

      return reply.send({
        items: reposts.map(({ createdAt, sound }) => ({
          id: sound.id,
          title: sound.title,
          bannerUrl: sound.bannerUrl,
          channelSlug: sound.channel.slug,
          artistUsername: sound.channel.user.username,
          artistDisplayName: userName(sound.channel.user),
          repostedAt: createdAt.toISOString(),
          url: resolveChannelUrl(sound.channel.slug, { hash: `sound-item-${sound.id}` }),
        })),
      })
    },
  )
}

export default userRepostsRoutes
