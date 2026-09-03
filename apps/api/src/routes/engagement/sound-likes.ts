// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  SoundLikeResponseSchema,
  ChannelSoundParamsSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { notifyArtistOfNewLike } from '@tahti/db'
import { requireAuth } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'

// The API path segment was "archive" before the Archive->Sound rename; kept registered
// alongside the new "sounds" path so bookmarked/third-party calls keep working.
const LIKE_PATHS = [
  '/api/v1/c/:slug/sounds/:itemId/like',
  '/api/v1/c/:slug/archive/:itemId/like',
] as const

const soundLikeRoutes: FastifyPluginAsync = async (fastify) => {
  for (const url of LIKE_PATHS) {
    fastify.post(
      url,
      {
        preHandler: requireAuth,
        schema: {
          tags: ['engagement'],
          description: 'M40: love a track',
          response: openApiResponse(SoundLikeResponseSchema, 'SoundLike'),
        },
      },
      async (request, reply) => {
        const user = request.sessionUser!
        const routeParams = parseRouteParams(ChannelSoundParamsSchema, request.params)
        if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
        const { slug, itemId } = routeParams

        const item = await fastify.prisma.sound.findFirst({
          where: { id: itemId, channel: { slug }, status: 'READY', isPublic: true },
          select: { id: true, title: true, channel: { select: { slug: true, userId: true } } },
        })
        if (!item) return reply.status(404).send({ error: 'Sound item not found' })

        const { didCreate } = await fastify.prisma.$transaction(async (tx) => {
          const existing = await tx.soundLike.findUnique({
            where: { userId_soundId: { userId: user.id, soundId: item.id } },
            select: { userId: true },
          })
          if (existing) return { didCreate: false }
          await tx.soundLike.create({
            data: { userId: user.id, soundId: item.id },
          })
          return { didCreate: true }
        })

        if (didCreate) {
          await notifyArtistOfNewLike(fastify.prisma, item.channel.userId, user, {
            id: item.id,
            title: item.title,
            channelSlug: item.channel.slug,
          }).catch((e) => fastify.log.warn(e, 'new-like notification failed'))
          await auditLog(fastify.prisma, {
            action: 'SOUND_ITEM_LIKE',
            actorId: user.id,
            targetId: item.id,
            meta: { title: item.title, channelSlug: item.channel.slug },
          })
        }

        const likeCount = await fastify.prisma.soundLike.count({
          where: { soundId: item.id },
        })

        return reply.send({ liked: true, likeCount })
      },
    )

    fastify.delete(
      url,
      {
        preHandler: requireAuth,
        schema: {
          tags: ['engagement'],
          description: 'M40: un-love a track',
          response: openApiResponse(SoundLikeResponseSchema, 'SoundLike'),
        },
      },
      async (request, reply) => {
        const user = request.sessionUser!
        const routeParams = parseRouteParams(ChannelSoundParamsSchema, request.params)
        if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
        const { slug, itemId } = routeParams

        const item = await fastify.prisma.sound.findFirst({
          where: { id: itemId, channel: { slug } },
          select: { id: true },
        })
        if (!item) return reply.status(404).send({ error: 'Sound item not found' })

        await fastify.prisma.soundLike.deleteMany({
          where: { userId: user.id, soundId: item.id },
        })

        const likeCount = await fastify.prisma.soundLike.count({
          where: { soundId: item.id },
        })

        return reply.send({ liked: false, likeCount })
      },
    )

    // GET is intentionally not auth-gated — the like count is public; `liked` just
    // reports false when there's no session instead of 401ing the whole page.
    fastify.get(
      url,
      {
        schema: {
          tags: ['engagement'],
          response: openApiResponse(SoundLikeResponseSchema, 'SoundLike'),
        },
      },
      async (request, reply) => {
        const user = request.sessionUser
        const routeParams = parseRouteParams(ChannelSoundParamsSchema, request.params)
        if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
        const { slug, itemId } = routeParams

        const item = await fastify.prisma.sound.findFirst({
          where: { id: itemId, channel: { slug } },
          select: { id: true },
        })
        if (!item) return reply.status(404).send({ error: 'Sound item not found' })

        const [like, likeCount] = await Promise.all([
          user
            ? fastify.prisma.soundLike.findUnique({
                where: { userId_soundId: { userId: user.id, soundId: item.id } },
              })
            : null,
          fastify.prisma.soundLike.count({ where: { soundId: item.id } }),
        ])

        return reply.send({ liked: !!like, likeCount })
      },
    )
  }
}

export default soundLikeRoutes
