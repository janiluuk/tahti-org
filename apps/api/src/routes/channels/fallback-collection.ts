// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import {
  ChannelFallbackCollectionsResponseSchema,
  ChannelTransportOkResponseSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const SetFallbackCollectionBodySchema = z.object({
  collectionId: z.string().nullable(),
})

/** Owner/board-only Manage tab control: repoint a channel's 24/7 fallback
 * rotation from the default isFallback-flagged track set to a chosen
 * Collection (or back to the default via collectionId: null). Slug-scoped
 * like manage-stats.ts/transport.ts — the dropdown always lists the CHANNEL
 * OWNER's collections (not the acting board member's), since that's whose
 * rotation is being repointed. */
const channelFallbackCollectionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/channels/:slug/fallback-collections',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: "Manage tab: list this channel owner's collections for the playlist switch",
        response: openApiResponse(
          ChannelFallbackCollectionsResponseSchema,
          'ChannelFallbackCollections',
        ),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const user = request.sessionUser!

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug: routeParams.slug },
        select: {
          userId: true,
          activeFallbackCollectionId: true,
          user: { select: { username: true } },
        },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      if (user.username !== channel.user.username && !user.isBoard) {
        return reply.status(403).send({ error: 'Not authorized to manage this channel' })
      }

      const collections = await fastify.prisma.collection.findMany({
        where: { userId: channel.userId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, _count: { select: { items: true } } },
      })

      return reply.send(
        collections.map((c) => ({
          id: c.id,
          name: c.name,
          trackCount: c._count.items,
          active: c.id === channel.activeFallbackCollectionId,
        })),
      )
    },
  )

  fastify.patch(
    '/api/channels/:slug/fallback-collection',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Manage tab: switch (or clear) the channel fallback rotation source',
        response: openApiResponse(ChannelTransportOkResponseSchema, 'ChannelTransportOk'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsedBody = SetFallbackCollectionBodySchema.safeParse(request.body)
      if (!parsedBody.success) {
        return reply
          .status(400)
          .send({ error: parsedBody.error.issues[0]?.message ?? 'Invalid body' })
      }
      const user = request.sessionUser!

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug: routeParams.slug },
        select: { id: true, userId: true, user: { select: { username: true } } },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      if (user.username !== channel.user.username && !user.isBoard) {
        return reply.status(403).send({ error: 'Not authorized to manage this channel' })
      }

      const { collectionId } = parsedBody.data
      if (collectionId) {
        const owned = await fastify.prisma.collection.findFirst({
          where: { id: collectionId, userId: channel.userId },
          select: { id: true },
        })
        if (!owned) return reply.status(404).send({ error: 'Collection not found' })
      }

      await fastify.prisma.channel.update({
        where: { id: channel.id },
        data: { activeFallbackCollectionId: collectionId },
      })

      return reply.send({ ok: true })
    },
  )
}

export default channelFallbackCollectionRoutes
