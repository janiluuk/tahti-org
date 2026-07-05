// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import {
  AddCollectionItemSchema,
  ChannelArchiveParamsSchema,
  CollectionGalleryPatchSchema,
  CollectionListQuerySchema,
  CollectionTextLayerPatchSchema,
  CreateCollectionSchema,
  PatchCollectionSchema,
  ReorderCollectionSchema,
  ReorderCollectionProfileSchema,
  CollectionPublicViewSchema,
  SlugParamSchema,
  UsernameParamSchema,
  archivePlaybackKey,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'
import { publicMediaUrl } from '../../lib/public-media-url.js'
import { presignedGetUrl } from '../../lib/minio.js'

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

const collectionItemInclude = {
  archiveItem: {
    select: {
      id: true,
      title: true,
      durationSec: true,
      mp3Key: true,
      flacKey: true,
      bannerUrl: true,
      description: true,
      createdAt: true,
      source: true,
      qualityBadge: true,
      embedUri: true,
      embedProvider: true,
    },
  },
  release: {
    select: {
      id: true,
      title: true,
      type: true,
      smartLinkSlug: true,
      releaseDate: true,
      artworkUrl: true,
      description: true,
    },
  },
} as const

// M23 — Collections: named groupings of archive items / releases
const collectionRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Artist-facing management ─────────────────────────────────────────────

  fastify.get(
    '/api/me/collections',
    {
      preHandler: requireAuth,
      schema: { tags: ['releases'], description: 'M23: list artist collections' },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsedQuery = CollectionListQuerySchema.safeParse(request.query)
      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: parsedQuery.error.issues[0]?.message ?? 'Invalid query',
        })
      }
      const expand = parsedQuery.data.expand === 'items'
      const cols = await fastify.prisma.collection.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        include: expand
          ? { items: { orderBy: { position: 'asc' }, include: collectionItemInclude } }
          : { _count: { select: { items: true } } },
      })
      return reply.send(cols)
    },
  )

  // GET /api/me/collections/:slug — single collection with items (management view)
  fastify.get('/api/me/collections/:slug', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const routeParams = parseRouteParams(SlugParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

    const col = await fastify.prisma.collection.findFirst({
      where: { slug: routeParams.slug, userId: user.id },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: collectionItemInclude,
        },
      },
    })
    if (!col) return reply.status(404).send({ error: 'Collection not found' })
    return reply.send(col)
  })

  // PUT /api/me/collections/reorder — reorder profile grid by slug order
  fastify.put(
    '/api/me/collections/reorder',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = ReorderCollectionProfileSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const { slugs } = parsed.data

      const cols = await fastify.prisma.collection.findMany({
        where: { userId: user.id },
        select: { id: true, slug: true },
      })

      const slugToId = new Map(cols.map((c) => [c.slug, c.id]))
      const updates: Array<{ id: string; order: number }> = []
      for (let i = 0; i < slugs.length; i++) {
        const id = slugToId.get(slugs[i]!)
        if (id) updates.push({ id, order: i })
      }

      await fastify.prisma.$transaction(
        updates.map((u) =>
          fastify.prisma.collection.update({
            where: { id: u.id },
            data: { publicProfileOrder: u.order },
          }),
        ),
      )

      return reply.status(204).send()
    },
  )

  fastify.post('/api/me/collections', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const parsed = CreateCollectionSchema.safeParse(request.body)
    if (!parsed.success) return zodError(reply, parsed.error)
    const body = parsed.data

    const slug =
      body.slug
        ?.trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-') ??
      `${user.username}-${body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 30)}`

    const type = body.type ?? 'CUSTOM'

    const existing = await fastify.prisma.collection.findUnique({ where: { slug } })
    if (existing) return reply.status(409).send({ error: 'Slug already taken' })

    const col = await fastify.prisma.collection.create({
      data: {
        userId: user.id,
        slug,
        name: body.name,
        description: body.description?.trim() || null,
        type,
        style: body.style,
        isPublic: body.isPublic ?? true,
        coverUrl: body.coverUrl?.trim() || null,
      },
    })
    return reply.status(201).send(col)
  })

  fastify.patch(
    '/api/me/collections/:slug',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams
      const parsed = PatchCollectionSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const body = parsed.data

      const col = await fastify.prisma.collection.findFirst({
        where: { slug, userId: user.id },
      })
      if (!col) return reply.status(404).send({ error: 'Collection not found' })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: Record<string, any> = {}
      if (body.name !== undefined) data.name = body.name
      if (body.description !== undefined) data.description = body.description
      if (body.style !== undefined) data.style = body.style
      if (body.isPublic !== undefined) data.isPublic = body.isPublic
      if (body.isFeatured !== undefined) data.isFeatured = body.isFeatured
      if (body.coverUrl !== undefined) data.coverUrl = body.coverUrl?.trim() || null

      const updated = await fastify.prisma.collection.update({ where: { id: col.id }, data })
      return reply.send(updated)
    },
  )

  fastify.delete(
    '/api/me/collections/:slug',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams

      const col = await fastify.prisma.collection.findFirst({
        where: { slug, userId: user.id },
      })
      if (!col) return reply.status(404).send({ error: 'Collection not found' })
      await fastify.prisma.collection.delete({ where: { id: col.id } })
      return reply.status(204).send()
    },
  )

  // POST /api/me/collections/:slug/items — add archive item or release
  fastify.post(
    '/api/me/collections/:slug/items',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams
      const parsed = AddCollectionItemSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const body = parsed.data

      const col = await fastify.prisma.collection.findFirst({
        where: { slug, userId: user.id },
        include: { _count: { select: { items: true } } },
      })
      if (!col) return reply.status(404).send({ error: 'Collection not found' })

      if (body.archiveItemId) {
        const archive = await fastify.prisma.archiveItem.findFirst({
          where: {
            id: body.archiveItemId,
            status: 'READY',
            channel: { userId: user.id },
          },
        })
        if (!archive) return reply.status(400).send({ error: 'Archive item not found' })
      }

      if (body.releaseId) {
        const release = await fastify.prisma.release.findFirst({
          where: { id: body.releaseId, userId: user.id, state: 'PUBLISHED' },
        })
        if (!release) return reply.status(400).send({ error: 'Published release not found' })
      }

      const position = body.position ?? col._count.items + 1

      // Shift existing items to make room
      await fastify.prisma.collectionItem.updateMany({
        where: { collectionId: col.id, position: { gte: position } },
        data: { position: { increment: 1 } },
      })

      const item = await fastify.prisma.collectionItem.create({
        data: {
          collectionId: col.id,
          archiveItemId: body.archiveItemId ?? null,
          releaseId: body.releaseId ?? null,
          position,
        },
      })
      return reply.status(201).send(item)
    },
  )

  // PUT /api/me/collections/:slug/reorder — M23 drag reorder
  fastify.put(
    '/api/me/collections/:slug/reorder',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams
      const parsed = ReorderCollectionSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const itemIds = parsed.data.itemIds

      const col = await fastify.prisma.collection.findFirst({
        where: { slug, userId: user.id },
        include: { items: { select: { id: true } } },
      })
      if (!col) return reply.status(404).send({ error: 'Collection not found' })

      const existing = new Set(col.items.map((i) => i.id))
      if (itemIds.length !== existing.size || itemIds.some((id) => !existing.has(id))) {
        return reply.status(400).send({ error: 'itemIds must match collection items exactly' })
      }

      // Two-phase update avoids @@unique([collectionId, position]) collisions while swapping.
      await fastify.prisma.$transaction(async (tx) => {
        for (let i = 0; i < itemIds.length; i++) {
          await tx.collectionItem.update({
            where: { id: itemIds[i] },
            data: { position: -(i + 1) },
          })
        }
        for (let i = 0; i < itemIds.length; i++) {
          await tx.collectionItem.update({
            where: { id: itemIds[i] },
            data: { position: i + 1 },
          })
        }
      })

      const items = await fastify.prisma.collectionItem.findMany({
        where: { collectionId: col.id },
        orderBy: { position: 'asc' },
        include: collectionItemInclude,
      })
      return reply.send({ items })
    },
  )

  // DELETE /api/me/collections/:slug/items/:itemId
  fastify.delete(
    '/api/me/collections/:slug/items/:itemId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ChannelArchiveParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug, itemId } = routeParams

      const col = await fastify.prisma.collection.findFirst({
        where: { slug, userId: user.id },
      })
      if (!col) return reply.status(404).send({ error: 'Collection not found' })

      await fastify.prisma.collectionItem.deleteMany({
        where: { id: itemId, collectionId: col.id },
      })
      return reply.status(204).send()
    },
  )

  // ── M26: per-collection backdrop theme (gallery + text layer) ────────────

  fastify.get(
    '/api/me/collections/:slug/gallery',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const col = await fastify.prisma.collection.findFirst({
        where: { slug: routeParams.slug, userId: user.id },
        select: { galleryMode: true, slideshowImages: true, videoBackgroundUrl: true },
      })
      if (!col) return reply.status(404).send({ error: 'Collection not found' })
      return reply.send(col)
    },
  )

  async function patchCollectionGallery(
    userId: string,
    slug: string,
    body: unknown,
  ): Promise<
    | {
        ok: true
        galleryMode: string
        slideshowImages: string[]
        videoBackgroundUrl: string | null
      }
    | { ok: false; status: number; error: string }
  > {
    const parsed = CollectionGalleryPatchSchema.safeParse(body)
    if (!parsed.success) {
      return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? 'Invalid body' }
    }
    if (
      parsed.data.galleryMode === undefined &&
      parsed.data.slideshowImages === undefined &&
      parsed.data.videoBackgroundUrl === undefined
    ) {
      return {
        ok: false,
        status: 400,
        error: 'galleryMode, slideshowImages, or videoBackgroundUrl required',
      }
    }

    const col = await fastify.prisma.collection.findFirst({
      where: { slug, userId },
      select: { id: true },
    })
    if (!col) return { ok: false, status: 404, error: 'Collection not found' }

    const updated = await fastify.prisma.collection.update({
      where: { id: col.id },
      data: {
        ...(parsed.data.galleryMode !== undefined ? { galleryMode: parsed.data.galleryMode } : {}),
        ...(parsed.data.slideshowImages !== undefined
          ? { slideshowImages: parsed.data.slideshowImages }
          : {}),
        ...(parsed.data.videoBackgroundUrl !== undefined
          ? { videoBackgroundUrl: parsed.data.videoBackgroundUrl }
          : {}),
      },
      select: { galleryMode: true, slideshowImages: true, videoBackgroundUrl: true },
    })

    return { ok: true, ...updated }
  }

  fastify.patch(
    '/api/me/collections/:slug/gallery',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const result = await patchCollectionGallery(user.id, routeParams.slug, request.body)
      if (!result.ok) return reply.status(result.status).send({ error: result.error })
      return reply.send({
        galleryMode: result.galleryMode,
        slideshowImages: result.slideshowImages,
        videoBackgroundUrl: result.videoBackgroundUrl,
      })
    },
  )

  fastify.get(
    '/api/me/collections/:slug/text-layer',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const col = await fastify.prisma.collection.findFirst({
        where: { slug: routeParams.slug, userId: user.id },
        select: { textLayerMode: true, textLayerText: true, textLayerAlign: true },
      })
      if (!col) return reply.status(404).send({ error: 'Collection not found' })
      return reply.send(col)
    },
  )

  async function patchCollectionTextLayer(
    userId: string,
    slug: string,
    body: unknown,
  ): Promise<
    | { ok: true; textLayerMode: string; textLayerText: string; textLayerAlign: string }
    | { ok: false; status: number; error: string }
  > {
    const parsed = CollectionTextLayerPatchSchema.safeParse(body)
    if (!parsed.success) {
      return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? 'Invalid body' }
    }
    if (
      parsed.data.textLayerMode === undefined &&
      parsed.data.textLayerText === undefined &&
      parsed.data.textLayerAlign === undefined
    ) {
      return {
        ok: false,
        status: 400,
        error: 'textLayerMode, textLayerText, or textLayerAlign required',
      }
    }

    const col = await fastify.prisma.collection.findFirst({
      where: { slug, userId },
      select: { id: true, textLayerMode: true, textLayerText: true, textLayerAlign: true },
    })
    if (!col) return { ok: false, status: 404, error: 'Collection not found' }

    const nextMode = parsed.data.textLayerMode ?? col.textLayerMode
    const nextText =
      parsed.data.textLayerText !== undefined ? parsed.data.textLayerText : col.textLayerText
    if (nextMode !== 'NONE' && nextText.trim().length === 0) {
      return {
        ok: false,
        status: 400,
        error: 'textLayerText is required when a text effect is enabled',
      }
    }

    const updated = await fastify.prisma.collection.update({
      where: { id: col.id },
      data: {
        ...(parsed.data.textLayerMode !== undefined
          ? { textLayerMode: parsed.data.textLayerMode }
          : {}),
        ...(parsed.data.textLayerText !== undefined
          ? { textLayerText: parsed.data.textLayerText }
          : {}),
        ...(parsed.data.textLayerAlign !== undefined
          ? { textLayerAlign: parsed.data.textLayerAlign }
          : {}),
      },
      select: { textLayerMode: true, textLayerText: true, textLayerAlign: true },
    })

    return { ok: true, ...updated }
  }

  fastify.patch(
    '/api/me/collections/:slug/text-layer',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const result = await patchCollectionTextLayer(user.id, routeParams.slug, request.body)
      if (!result.ok) return reply.status(result.status).send({ error: result.error })
      return reply.send({
        textLayerMode: result.textLayerMode,
        textLayerText: result.textLayerText,
        textLayerAlign: result.textLayerAlign,
      })
    },
  )

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

      // Presign playback URLs for items with real Tahti audio — embed-only items have
      // no rawKey/flacKey/mp3Key and stay null, so the public page never tries to play them.
      const items = await Promise.all(
        col.items.map(async (colItem) => {
          if (!colItem.archiveItem) return colItem
          const playbackKey = archivePlaybackKey(colItem.archiveItem)
          const audioUrl = playbackKey ? await presignedGetUrl(playbackKey, 3600) : null
          return { ...colItem, archiveItem: { ...colItem.archiveItem, audioUrl } }
        }),
      )

      return reply.send({
        ...col,
        items,
        links: {
          page: `${config.appUrl}/u/${col.user.username}/c/${col.slug}`,
          rss: `${config.apiUrl}/api/v1/collections/${col.slug}/rss.xml`,
        },
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

  // GET /api/v1/c/:slug/rss.xml — channel archive RSS feed
  fastify.get('/api/v1/c/:slug/rss.xml', async (request, reply) => {
    const routeParams = parseRouteParams(SlugParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const { slug } = routeParams

    const channel = await loadChannelArchiveRssSource(fastify, slug)
    if (!channel) return reply.status(404).send({ error: 'Channel not found' })

    return reply
      .header('Content-Type', 'application/rss+xml; charset=utf-8')
      .send(buildChannelArchiveRssXml(channel))
  })

  // GET /api/v1/u/:username/rss.xml — artist archive RSS (podcast clients use @handle)
  fastify.get('/api/v1/u/:username/rss.xml', async (request, reply) => {
    const routeParams = parseRouteParams(UsernameParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const { username } = routeParams

    const user = await fastify.prisma.user.findUnique({
      where: { username },
      select: { channel: { select: { slug: true } } },
    })
    if (!user?.channel) return reply.status(404).send({ error: 'Artist not found' })

    const channel = await loadChannelArchiveRssSource(fastify, user.channel.slug)
    if (!channel) return reply.status(404).send({ error: 'Channel not found' })

    return reply
      .header('Content-Type', 'application/rss+xml; charset=utf-8')
      .send(buildChannelArchiveRssXml(channel))
  })
}

type ChannelArchiveRssSource = {
  slug: string
  user: { username: string; displayName: string; bio: string | null }
  archiveItems: Array<{
    id: string
    title: string
    description: string | null
    durationSec: number | null
    mp3Key: string | null
    flacKey: string | null
    createdAt: Date
  }>
}

async function loadChannelArchiveRssSource(
  fastify: Pick<FastifyInstance, 'prisma'>,
  slug: string,
): Promise<ChannelArchiveRssSource | null> {
  return fastify.prisma.channel.findUnique({
    where: { slug },
    select: {
      slug: true,
      user: { select: { username: true, displayName: true, bio: true } },
      archiveItems: {
        where: { status: 'READY', isPublic: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          title: true,
          description: true,
          durationSec: true,
          mp3Key: true,
          flacKey: true,
          createdAt: true,
        },
      },
    },
  })
}

function buildChannelArchiveRssXml(channel: ChannelArchiveRssSource): string {
  return buildRss({
    title: `${channel.user.displayName} — Tahti`,
    description: channel.user.bio ?? `${channel.user.displayName} on Tahti`,
    link: `${config.appUrl}/u/${channel.user.username}`,
    items: channel.archiveItems.map((i) => ({
      title: i.title,
      description: i.description ?? '',
      pubDate: i.createdAt,
      duration: i.durationSec ?? 0,
      enclosureUrl: publicMediaUrl(archivePlaybackKey(i)),
      guid: `${config.appUrl}/c/${channel.slug}#${i.id}`,
    })),
  })
}

interface RssItem {
  title: string
  description: string
  pubDate: Date
  duration: number
  enclosureUrl: string | null
  guid: string
}

type CollectionItemRow = {
  archiveItem: {
    id: string
    title: string
    description: string | null
    durationSec: number | null
    mp3Key: string | null
    flacKey: string | null
    createdAt: Date
  } | null
  release: {
    title: string
    description: string | null
    smartLinkSlug: string
    releaseDate: Date
  } | null
}

function collectionRssItems(items: CollectionItemRow[], username: string): RssItem[] {
  const out: RssItem[] = []
  for (const i of items) {
    if (i.archiveItem) {
      out.push({
        title: i.archiveItem.title,
        description: i.archiveItem.description ?? '',
        pubDate: i.archiveItem.createdAt,
        duration: i.archiveItem.durationSec ?? 0,
        enclosureUrl: publicMediaUrl(archivePlaybackKey(i.archiveItem)),
        guid: `${config.appUrl}/u/${username}/c/item/${i.archiveItem.id}`,
      })
    } else if (i.release) {
      out.push({
        title: i.release.title,
        description: i.release.description ?? '',
        pubDate: i.release.releaseDate,
        duration: 0,
        enclosureUrl: null,
        guid: `${config.appUrl}/r/${i.release.smartLinkSlug}`,
      })
    }
  }
  return out
}

function buildRss(opts: {
  title: string
  description: string
  link: string
  items: RssItem[]
}): string {
  const items = opts.items
    .map((i) => {
      const enclosure = i.enclosureUrl
        ? `<enclosure url="${escXml(i.enclosureUrl)}" type="audio/mpeg" length="0"/>`
        : ''
      const mins = Math.floor(i.duration / 60)
      const secs = i.duration % 60
      const dur = `${mins}:${String(secs).padStart(2, '0')}`
      return `
    <item>
      <title>${escXml(i.title)}</title>
      <description>${escXml(i.description)}</description>
      <pubDate>${i.pubDate.toUTCString()}</pubDate>
      <guid isPermaLink="true">${escXml(i.guid)}</guid>
      <itunes:duration>${dur}</itunes:duration>
      ${enclosure}
    </item>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escXml(opts.title)}</title>
    <description>${escXml(opts.description)}</description>
    <link>${escXml(opts.link)}</link>
    <language>fi</language>
    <generator>Tahti ry — https://tahti.live</generator>
    ${items}
  </channel>
</rss>`
}

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default collectionRoutes
