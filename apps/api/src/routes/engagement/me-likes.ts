// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  MeLikesQuerySchema,
  MeLikesResponseSchema,
  openApiResponse,
  safeDisplayName,
  soundPlaybackKey,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { resolveGatedPlaybackUrl } from '../../lib/playback-url.js'
import { resolveChannelUrl } from '../../lib/channel-url.js'

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

      const likes = await fastify.prisma.soundLike.findMany({
        where: {
          userId: user.id,
          sound: {
            status: 'READY',
            OR: [{ isPublic: true }, { channel: { userId: user.id } }],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: query.data.limit,
        select: {
          createdAt: true,
          sound: {
            select: {
              id: true,
              title: true,
              artistName: true,
              bannerUrl: true,
              mp3Key: true,
              flacKey: true,
              accessMode: true,
              purchaseTierId: true,
              channel: {
                select: {
                  slug: true,
                  userId: true,
                  user: { select: { username: true, displayName: true } },
                },
              },
            },
          },
        },
      })

      const items = await Promise.all(
        likes.map(async ({ createdAt, sound }) => {
          const { url } = await resolveGatedPlaybackUrl(fastify.prisma, {
            playbackKey: soundPlaybackKey(sound),
            artistUserId: sound.channel.userId,
            accessMode: sound.accessMode,
            purchaseTierId: sound.purchaseTierId,
            viewerUserId: user.id,
          })
          const artist = sound.channel.user
          return {
            id: sound.id,
            title: sound.title,
            bannerUrl: sound.bannerUrl,
            audioUrl: url,
            channelSlug: sound.channel.slug,
            artistUsername: artist.username,
            artistDisplayName:
              sound.artistName || safeDisplayName(artist.displayName, artist.username),
            likedAt: createdAt.toISOString(),
            url: resolveChannelUrl(sound.channel.slug, { hash: `sound-item-${sound.id}` }),
          }
        }),
      )

      return reply.send({ items })
    },
  )
}

export default meLikesRoutes
