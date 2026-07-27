// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ArchiveItemRepostResponseSchema,
  ChannelArchiveParamsSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { notifyArtistOfNewRepost } from '@tahti/db'
import { requireAuth } from '../../plugins/auth.js'

// Distinct from routes/engagement/archive-repost.ts (ArchiveRepostAck — an
// acknowledgment gating a download, unrelated to sharing) — this is a real
// repost/share action, same shape as archive-likes.ts.
const archiveItemRepostRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/v1/c/:slug/archive/:itemId/repost',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['engagement'],
        description: 'Repost/share a track',
        response: openApiResponse(ArchiveItemRepostResponseSchema, 'ArchiveItemRepost'),
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
        const existing = await tx.archiveItemRepost.findUnique({
          where: { userId_archiveItemId: { userId: user.id, archiveItemId: item.id } },
          select: { userId: true },
        })
        if (existing) return { didCreate: false }
        await tx.archiveItemRepost.create({
          data: { userId: user.id, archiveItemId: item.id },
        })
        return { didCreate: true }
      })

      if (didCreate) {
        await notifyArtistOfNewRepost(fastify.prisma, item.channel.userId, user, {
          id: item.id,
          title: item.title,
          channelSlug: item.channel.slug,
        }).catch((e) => fastify.log.warn(e, 'new-repost notification failed'))
      }

      const repostCount = await fastify.prisma.archiveItemRepost.count({
        where: { archiveItemId: item.id },
      })

      return reply.send({ reposted: true, repostCount })
    },
  )

  fastify.delete(
    '/api/v1/c/:slug/archive/:itemId/repost',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['engagement'],
        description: 'Remove a repost',
        response: openApiResponse(ArchiveItemRepostResponseSchema, 'ArchiveItemRepost'),
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

      await fastify.prisma.archiveItemRepost.deleteMany({
        where: { userId: user.id, archiveItemId: item.id },
      })

      const repostCount = await fastify.prisma.archiveItemRepost.count({
        where: { archiveItemId: item.id },
      })

      return reply.send({ reposted: false, repostCount })
    },
  )

  // GET is intentionally not auth-gated — the repost count is public; `reposted`
  // just reports false when there's no session instead of 401ing the whole page.
  fastify.get(
    '/api/v1/c/:slug/archive/:itemId/repost',
    {
      schema: {
        tags: ['engagement'],
        response: openApiResponse(ArchiveItemRepostResponseSchema, 'ArchiveItemRepost'),
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

      const [repost, repostCount] = await Promise.all([
        user
          ? fastify.prisma.archiveItemRepost.findUnique({
              where: { userId_archiveItemId: { userId: user.id, archiveItemId: item.id } },
            })
          : null,
        fastify.prisma.archiveItemRepost.count({ where: { archiveItemId: item.id } }),
      ])

      return reply.send({ reposted: !!repost, repostCount })
    },
  )
}

export default archiveItemRepostRoutes
