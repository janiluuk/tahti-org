// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { notifyPlaylistOfNewTrack } from '@tahti/db'
import {
  AddCollaborativeTrackSchema,
  CatalogTrackSearchQuerySchema,
  CatalogTrackSearchResponseSchema,
  CollectionPublicViewSchema,
  CollectionSubscriptionResponseSchema,
  SlugParamSchema,
  UsernameParamSchema,
  soundPlaybackKey,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'
import { resolveCollectionCoverUrl } from '../../lib/collection-cover.js'
import { isUniqueConstraintError } from '../../lib/prisma-errors.js'
import { resolveGatedPlaybackUrl } from '../../lib/playback-url.js'
import { collectionItemInclude, sortCollectionItems, zodError } from './helpers.js'
import {
  buildChannelSoundRssXml,
  buildRss,
  collectionRssItems,
  loadChannelSoundRssSource,
} from './rss.js'

export const publicCollectionRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Public endpoints ────────────────────────────────────────────────────

  fastify.get(
    '/api/v1/collections/:slug',
    {
      schema: {
        tags: ['releases'],
        description: 'M23: public collection page payload',
        response: openApiResponse(CollectionPublicViewSchema, 'CollectionPublic'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams

      const col = await fastify.prisma.collection.findFirst({
        where: { slug, isPublic: true },
        include: {
          user: { select: { username: true, displayName: true } },
          items: {
            orderBy: { position: 'asc' },
            include: collectionItemInclude,
          },
        },
      })
      if (!col) return reply.status(404).send({ error: 'Collection not found' })

      const ordered = sortCollectionItems(col.items, col.trackSortMode)
      const viewerUserId = request.sessionUser?.id ?? null

      // Presign playback URLs for items with real Tahti audio — embed-only items have
      // no rawKey/flacKey/mp3Key and stay null, so the public page never tries to play them.
      // Purchase/subscriber gates run per viewer; never cache these URLs.
      const items = await Promise.all(
        ordered.map(async (colItem) => {
          if (!colItem.sound) return colItem
          const playbackKey = soundPlaybackKey(colItem.sound)
          const { url, gate } = await resolveGatedPlaybackUrl(fastify.prisma, {
            playbackKey,
            artistUserId: colItem.sound.channel.userId,
            accessMode: colItem.sound.accessMode,
            purchaseTierId: colItem.sound.purchaseTierId,
            viewerUserId,
          })
          const { channel, ...soundRest } = colItem.sound
          return {
            ...colItem,
            sound: {
              ...soundRest,
              audioUrl: url,
              gate,
              channel: { slug: channel.slug },
            },
          }
        }),
      )

      return reply.send({
        ...col,
        coverUrl: await resolveCollectionCoverUrl(col),
        items,
        links: {
          page: `${config.appUrl}/u/${col.user.username}/c/${col.slug}`,
          rss: `${config.apiUrl}/api/v1/collections/${col.slug}/rss.xml`,
        },
      })
    },
  )

  // POST /api/v1/collections/:slug/items — any logged-in user adds a track to a
  // collaborative public playlist. Distinct from the owner-only
  // /api/me/collections/:slug/items above: no ownership check on the sound
  // item (any public, READY track in the catalog), always appended at the end,
  // and gated on collection.collaborative rather than collection.userId.
  fastify.post(
    '/api/v1/collections/:slug/items',
    { preHandler: requireAuth },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams
      const parsed = AddCollaborativeTrackSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const { soundId, note } = parsed.data
      const user = request.sessionUser!

      const col = await fastify.prisma.collection.findFirst({
        where: { slug, isPublic: true, collaborative: true },
        include: {
          _count: { select: { items: true } },
          user: { select: { id: true, username: true } },
        },
      })
      if (!col) return reply.status(404).send({ error: 'Collection not found' })

      const sound = await fastify.prisma.sound.findFirst({
        where: { id: soundId, status: 'READY', isPublic: true },
        select: { id: true, title: true },
      })
      if (!sound) return reply.status(400).send({ error: 'Track not found' })

      const existing = await fastify.prisma.collectionItem.findFirst({
        where: { collectionId: col.id, soundId },
        select: { id: true },
      })
      if (existing) return reply.status(409).send({ error: 'Already in this playlist' })

      try {
        const item = await fastify.prisma.collectionItem.create({
          data: {
            collectionId: col.id,
            soundId,
            position: col._count.items + 1,
            addedByUserId: user.id,
            addNote: note || null,
          },
        })
        await notifyPlaylistOfNewTrack(
          fastify.prisma,
          {
            id: col.id,
            slug: col.slug,
            name: col.name,
            ownerUsername: col.user.username,
            ownerUserId: col.user.id,
          },
          user,
          { title: sound.title },
        ).catch((err: unknown) => fastify.log.warn({ err }, 'playlist-add notification failed'))
        return reply.status(201).send(item)
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          return reply
            .status(409)
            .send({ error: 'Another track was added at the same time — please retry' })
        }
        throw err
      }
    },
  )

  // GET /api/v1/collections/:slug/subscribe — public: reports subscribed: false
  // when there's no session instead of 401ing, same as the sound-item like route.
  fastify.get(
    '/api/v1/collections/:slug/subscribe',
    {
      schema: {
        response: openApiResponse(CollectionSubscriptionResponseSchema, 'CollectionSubscription'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const col = await fastify.prisma.collection.findFirst({
        where: { slug: routeParams.slug, isPublic: true },
        select: { id: true, _count: { select: { subscribers: true } } },
      })
      if (!col) return reply.status(404).send({ error: 'Collection not found' })

      const subscribed = request.sessionUser
        ? !!(await fastify.prisma.collectionSubscription.findUnique({
            where: {
              userId_collectionId: { userId: request.sessionUser.id, collectionId: col.id },
            },
            select: { userId: true },
          }))
        : false

      return reply.send({ subscribed, subscriberCount: col._count.subscribers })
    },
  )

  // POST /api/v1/collections/:slug/subscribe
  fastify.post(
    '/api/v1/collections/:slug/subscribe',
    { preHandler: requireAuth },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const col = await fastify.prisma.collection.findFirst({
        where: { slug: routeParams.slug, isPublic: true },
        select: { id: true },
      })
      if (!col) return reply.status(404).send({ error: 'Collection not found' })

      await fastify.prisma.collectionSubscription.upsert({
        where: {
          userId_collectionId: { userId: request.sessionUser!.id, collectionId: col.id },
        },
        create: { userId: request.sessionUser!.id, collectionId: col.id },
        update: {},
      })

      const subscriberCount = await fastify.prisma.collectionSubscription.count({
        where: { collectionId: col.id },
      })
      return reply.send({ subscribed: true, subscriberCount })
    },
  )

  // DELETE /api/v1/collections/:slug/subscribe
  fastify.delete(
    '/api/v1/collections/:slug/subscribe',
    { preHandler: requireAuth },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const col = await fastify.prisma.collection.findFirst({
        where: { slug: routeParams.slug, isPublic: true },
        select: { id: true },
      })
      if (!col) return reply.status(404).send({ error: 'Collection not found' })

      await fastify.prisma.collectionSubscription.deleteMany({
        where: { userId: request.sessionUser!.id, collectionId: col.id },
      })

      const subscriberCount = await fastify.prisma.collectionSubscription.count({
        where: { collectionId: col.id },
      })
      return reply.send({ subscribed: false, subscriberCount })
    },
  )

  // GET /api/v1/search/tracks?q= — public catalog search, powers the "Add track"
  // picker on a collaborative playlist. Same isPublic+READY filter as every
  // other public track listing in the app.
  fastify.get(
    '/api/v1/search/tracks',
    {
      schema: {
        tags: ['releases'],
        response: openApiResponse(CatalogTrackSearchResponseSchema, 'CatalogTrackSearch'),
      },
    },
    async (request, reply) => {
      const parsedQuery = CatalogTrackSearchQuerySchema.safeParse(request.query)
      if (!parsedQuery.success) {
        return reply
          .status(400)
          .send({ error: parsedQuery.error.issues[0]?.message ?? 'Invalid query' })
      }
      const { q, offset = 0 } = parsedQuery.data
      const PAGE_SIZE = 20

      const items = await fastify.prisma.sound.findMany({
        where: {
          isPublic: true,
          status: 'READY',
          ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: PAGE_SIZE + 1,
        select: {
          id: true,
          title: true,
          durationSec: true,
          artistName: true,
          channel: { select: { slug: true, user: { select: { displayName: true } } } },
        },
      })

      const hasMore = items.length > PAGE_SIZE
      const page = items.slice(0, PAGE_SIZE)

      return reply.send({
        tracks: page.map((item) => ({
          id: item.id,
          title: item.title,
          durationSec: item.durationSec,
          artistName: item.artistName ?? item.channel.user.displayName,
          channelSlug: item.channel.slug,
        })),
        hasMore,
      })
    },
  )

  // GET /api/v1/collections/:slug/rss.xml — collection RSS feed
  fastify.get('/api/v1/collections/:slug/rss.xml', async (request, reply) => {
    const routeParams = parseRouteParams(SlugParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const { slug } = routeParams

    const col = await fastify.prisma.collection.findFirst({
      where: { slug, isPublic: true },
      include: {
        user: { select: { username: true, displayName: true } },
        items: {
          orderBy: { position: 'asc' },
          include: collectionItemInclude,
        },
      },
    })
    if (!col) return reply.status(404).send({ error: 'Collection not found' })

    const xml = buildRss({
      title: col.name,
      description: col.description ?? `${col.name} by ${col.user.displayName}`,
      link: `${config.appUrl}/u/${col.user.username}/c/${col.slug}`,
      items: collectionRssItems(col.items, col.user.username),
    })

    return reply.header('Content-Type', 'application/rss+xml; charset=utf-8').send(xml)
  })

  // GET /api/v1/c/:slug/rss.xml — channel sound RSS feed
  fastify.get('/api/v1/c/:slug/rss.xml', async (request, reply) => {
    const routeParams = parseRouteParams(SlugParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const { slug } = routeParams

    const channel = await loadChannelSoundRssSource(fastify, slug)
    if (!channel) return reply.status(404).send({ error: 'Channel not found' })

    return reply
      .header('Content-Type', 'application/rss+xml; charset=utf-8')
      .send(buildChannelSoundRssXml(channel))
  })

  // GET /api/v1/u/:username/rss.xml — artist sound RSS (podcast clients use @handle)
  fastify.get('/api/v1/u/:username/rss.xml', async (request, reply) => {
    const routeParams = parseRouteParams(UsernameParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const { username } = routeParams

    const user = await fastify.prisma.user.findUnique({
      where: { username },
      select: { channel: { select: { slug: true } } },
    })
    if (!user?.channel) return reply.status(404).send({ error: 'Artist not found' })

    const channel = await loadChannelSoundRssSource(fastify, user.channel.slug)
    if (!channel) return reply.status(404).send({ error: 'Channel not found' })

    return reply
      .header('Content-Type', 'application/rss+xml; charset=utf-8')
      .send(buildChannelSoundRssXml(channel))
  })
}
