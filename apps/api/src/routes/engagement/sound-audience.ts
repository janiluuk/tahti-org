// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ChannelSoundParamsSchema,
  SoundAudienceQuerySchema,
  SoundAudienceResponseSchema,
  openApiResponse,
  parseRouteParams,
  safeDisplayName,
  type SoundAudiencePerson,
} from '@tahti/shared'
import { availableUserWhere } from '@tahti/db'

type PersonRow = {
  createdAt: Date
  user: { username: string; displayName: string | null; avatarUrl: string | null }
}

function person(row: PersonRow): SoundAudiencePerson {
  return {
    username: row.user.username,
    displayName: safeDisplayName(row.user.displayName, row.user.username),
    avatarUrl: row.user.avatarUrl,
    at: row.createdAt.toISOString(),
  }
}

const personSelect = {
  createdAt: true,
  user: { select: { username: true, displayName: true, avatarUrl: true } },
} as const

const soundAudienceRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/c/:slug/sounds/:itemId/audience — the public collections a
  // sound is in and who liked, reposted and played it. Players are signed-in
  // listeners only (anonymous listens have no person), never the artist.
  fastify.get(
    '/api/v1/c/:slug/sounds/:itemId/audience',
    {
      schema: {
        tags: ['engagement'],
        response: openApiResponse(SoundAudienceResponseSchema, 'SoundAudience'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(ChannelSoundParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const query = SoundAudienceQuerySchema.safeParse(request.query)
      if (!query.success) return reply.status(400).send({ error: 'Invalid query' })
      const { limit, offset, tab } = query.data
      const want = (name: typeof tab) => !tab || tab === name
      const viewer = request.sessionUser

      const sound = await fastify.prisma.sound.findFirst({
        where: {
          id: routeParams.itemId,
          channel: { slug: routeParams.slug },
          OR: [
            { isPublic: true, status: 'READY', channel: { user: availableUserWhere } },
            ...(viewer ? [{ channel: { userId: viewer.id } }] : []),
          ],
        },
        select: { id: true, channel: { select: { userId: true } } },
      })
      if (!sound) return reply.status(404).send({ error: 'Sound item not found' })

      const collectionWhere = {
        isPublic: true,
        visibility: 'PUBLIC' as const,
        user: availableUserWhere,
        items: { some: { soundId: sound.id } },
      }
      const likeWhere = { soundId: sound.id, user: availableUserWhere }
      const repostWhere = { soundId: sound.id, user: availableUserWhere }
      const playWhere = {
        soundId: sound.id,
        isBot: false,
        byUserId: { not: null, notIn: [sound.channel.userId] },
      }

      const [collections, collectionTotal, likes, likeTotal, reposts, repostTotal, playGroups] =
        await Promise.all([
          !want('collections')
            ? []
            : fastify.prisma.collection.findMany({
                where: collectionWhere,
                orderBy: { updatedAt: 'desc' },
                skip: offset,
                take: limit,
                select: {
                  slug: true,
                  name: true,
                  coverUrl: true,
                  user: { select: { username: true, displayName: true } },
                  _count: { select: { items: true } },
                },
              }),
          !want('collections') ? 0 : fastify.prisma.collection.count({ where: collectionWhere }),
          !want('likes')
            ? []
            : fastify.prisma.soundLike.findMany({
                where: likeWhere,
                orderBy: { createdAt: 'desc' },
                skip: offset,
                take: limit,
                select: personSelect,
              }),
          !want('likes') ? 0 : fastify.prisma.soundLike.count({ where: likeWhere }),
          !want('reposts')
            ? []
            : fastify.prisma.soundRepost.findMany({
                where: repostWhere,
                orderBy: { createdAt: 'desc' },
                skip: offset,
                take: limit,
                select: personSelect,
              }),
          !want('reposts') ? 0 : fastify.prisma.soundRepost.count({ where: repostWhere }),
          !want('plays')
            ? []
            : fastify.prisma.listenSession.groupBy({
                by: ['byUserId'],
                where: playWhere,
                _count: { _all: true },
                _max: { startedAt: true },
              }),
        ])

      const listenerIds = playGroups
        .map((group) => group.byUserId)
        .filter((id): id is string => Boolean(id))
      const listeners = listenerIds.length
        ? await fastify.prisma.user.findMany({
            where: { id: { in: listenerIds }, ...availableUserWhere },
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          })
        : []
      const listenerById = new Map(listeners.map((user) => [user.id, user]))
      const plays = playGroups
        .flatMap((group) => {
          const user = group.byUserId ? listenerById.get(group.byUserId) : undefined
          if (!user || !group._max.startedAt) return []
          return [{ user, plays: group._count._all, at: group._max.startedAt }]
        })
        .sort((a, b) => b.at.getTime() - a.at.getTime())

      return reply.send({
        collections: {
          total: collectionTotal,
          items: collections.map((collection) => ({
            slug: collection.slug,
            name: collection.name,
            coverUrl: collection.coverUrl,
            ownerUsername: collection.user.username,
            ownerName: safeDisplayName(collection.user.displayName, collection.user.username),
            itemCount: collection._count.items,
          })),
        },
        likes: { total: likeTotal, items: likes.map(person) },
        reposts: { total: repostTotal, items: reposts.map(person) },
        plays: {
          total: plays.length,
          items: plays.slice(offset, offset + limit).map(({ user, plays: count, at }) => ({
            username: user.username,
            displayName: safeDisplayName(user.displayName, user.username),
            avatarUrl: user.avatarUrl,
            at: at.toISOString(),
            plays: count,
          })),
        },
      })
    },
  )
}

export default soundAudienceRoutes
