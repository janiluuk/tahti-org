// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ArchiveItemLikeResponseSchema,
  ChannelArchiveParamsSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { notifyArtistOfNewLike } from '@tahti/db'
import { requireAuth } from '../../plugins/auth.js'

const archiveLikeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/v1/c/:slug/archive/:itemId/like',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['engagement'],
        description: 'M40: love a track',
        response: openApiResponse(ArchiveItemLikeResponseSchema, 'ArchiveItemLike'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ChannelArchiveParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug, itemId } = routeParams

      const item = await fastify.prisma.archiveItem.findFirst({
        where: { id: itemId, channel: { slug }, status: 'READY', isPublic: true },
        select: { id: true, title: true, channel: { select: { slug: true, userId: true } } },
      })
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })

      const { didCreate } = await fastify.prisma.$transaction(async (tx) => {
        const existing = await tx.archiveItemLike.findUnique({
          where: { userId_archiveItemId: { userId: user.id, archiveItemId: item.id } },
          select: { userId: true },
        })
        if (existing) return { didCreate: false }
        await tx.archiveItemLike.create({
          data: { userId: user.id, archiveItemId: item.id },
        })
        return { didCreate: true }
      })

      if (didCreate) {
        await notifyArtistOfNewLike(fastify.prisma, item.channel.userId, user, {
          id: item.id,
          title: item.title,
          channelSlug: item.channel.slug,
        }).catch((e) => fastify.log.warn(e, 'new-like notification failed'))
      }

      const likeCount = await fastify.prisma.archiveItemLike.count({
        where: { archiveItemId: item.id },
      })

      return reply.send({ liked: true, likeCount })
    },
  )

  fastify.delete(
    '/api/v1/c/:slug/archive/:itemId/like',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['engagement'],
        description: 'M40: un-love a track',
        response: openApiResponse(ArchiveItemLikeResponseSchema, 'ArchiveItemLike'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ChannelArchiveParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug, itemId } = routeParams

      const item = await fastify.prisma.archiveItem.findFirst({
        where: { id: itemId, channel: { slug } },
        select: { id: true },
      })
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })

      await fastify.prisma.archiveItemLike.deleteMany({
        where: { userId: user.id, archiveItemId: item.id },
      })

      const likeCount = await fastify.prisma.archiveItemLike.count({
        where: { archiveItemId: item.id },
      })

      return reply.send({ liked: false, likeCount })
    },
  )

  // GET is intentionally not auth-gated — the like count is public; `liked` just
  // reports false when there's no session instead of 401ing the whole page.
  fastify.get(
    '/api/v1/c/:slug/archive/:itemId/like',
    {
      schema: {
        tags: ['engagement'],
        response: openApiResponse(ArchiveItemLikeResponseSchema, 'ArchiveItemLike'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser
      const routeParams = parseRouteParams(ChannelArchiveParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug, itemId } = routeParams

      const item = await fastify.prisma.archiveItem.findFirst({
        where: { id: itemId, channel: { slug } },
        select: { id: true },
      })
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })

      const [like, likeCount] = await Promise.all([
        user
          ? fastify.prisma.archiveItemLike.findUnique({
              where: { userId_archiveItemId: { userId: user.id, archiveItemId: item.id } },
            })
          : null,
        fastify.prisma.archiveItemLike.count({ where: { archiveItemId: item.id } }),
      ])

      return reply.send({ liked: !!like, likeCount })
    },
  )
}

export default archiveLikeRoutes
