// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AddCollectionItemSchema,
  ChannelSoundParamsSchema,
  CollectionListQuerySchema,
  CreateCollectionSchema,
  PatchCollectionSchema,
  ReorderCollectionSchema,
  ReorderCollectionProfileSchema,
  SlugParamSchema,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { resolveCollectionCoverUrl } from '../../lib/collection-cover.js'
import { refreshCollectionCoverPalette } from '../../lib/collection-palette.js'
import { isUniqueConstraintError } from '../../lib/prisma-errors.js'
import { addManagementPlayback, collectionItemInclude, zodError } from './helpers.js'

const meCollectionRoutes: FastifyPluginAsync = async (fastify) => {
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
      const withCovers = await Promise.all(
        cols.map(async (col) => ({ ...col, coverUrl: await resolveCollectionCoverUrl(col) })),
      )
      return reply.send(withCovers)
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
    return reply.send(
      await addManagementPlayback(
        fastify,
        { ...col, coverUrl: await resolveCollectionCoverUrl(col) },
        user.id,
      ),
    )
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

    try {
      const col = await fastify.prisma.collection.create({
        data: {
          userId: user.id,
          slug,
          name: body.name,
          description: body.description?.trim() || null,
          type,
          style: body.style as never,
          isPublic: body.isPublic ?? true,
          coverUrl: body.coverUrl?.trim() || null,
        },
      })
      if (col.coverUrl) refreshCollectionCoverPalette(fastify.prisma, col.id, col.coverUrl)
      return reply.status(201).send(col)
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        return reply.status(409).send({ error: 'Slug already taken' })
      }
      throw err
    }
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
      if (body.trackSortMode !== undefined) data.trackSortMode = body.trackSortMode
      if (body.isPublic !== undefined) data.isPublic = body.isPublic
      if (body.isFeatured !== undefined) data.isFeatured = body.isFeatured
      if (body.collaborative !== undefined) data.collaborative = body.collaborative
      if (body.coverUrl !== undefined) {
        data.coverUrl = body.coverUrl?.trim() || null
        // Switching to a directly-set (possibly external) URL invalidates any
        // previously uploaded cover's object key — coverUrl becomes the source
        // of truth again until the next upload sets coverKey.
        data.coverKey = null
      }

      const updated = await fastify.prisma.collection.update({ where: { id: col.id }, data })
      if (body.coverUrl !== undefined && updated.coverUrl) {
        refreshCollectionCoverPalette(fastify.prisma, updated.id, updated.coverUrl)
      }
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

  // POST /api/me/collections/:slug/items — add sound item or release
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

      if (body.soundId) {
        // Own tracks (any visibility) or anyone's public track — this is the
        // "save a track I'm listening to" path, not just the uploader managing
        // their own sound.
        const sound = await fastify.prisma.sound.findFirst({
          where: {
            id: body.soundId,
            status: 'READY',
            OR: [{ channel: { userId: user.id } }, { isPublic: true }],
          },
        })
        if (!sound) return reply.status(400).send({ error: 'Sound item not found' })
      }

      if (body.releaseId) {
        const release = await fastify.prisma.release.findFirst({
          where: { id: body.releaseId, userId: user.id, state: 'PUBLISHED' },
        })
        if (!release) return reply.status(400).send({ error: 'Published release not found' })
      }

      if (body.soundId || body.releaseId) {
        const existing = await fastify.prisma.collectionItem.findFirst({
          where: {
            collectionId: col.id,
            ...(body.soundId ? { soundId: body.soundId } : { releaseId: body.releaseId }),
          },
          select: { id: true },
        })
        if (existing) return reply.status(409).send({ error: 'Already in this playlist' })
      }

      const position = body.position ?? col._count.items + 1

      try {
        const item = await fastify.prisma.$transaction(async (tx) => {
          // Shift existing items to make room
          await tx.collectionItem.updateMany({
            where: { collectionId: col.id, position: { gte: position } },
            data: { position: { increment: 1 } },
          })
          return tx.collectionItem.create({
            data: {
              collectionId: col.id,
              soundId: body.soundId ?? null,
              releaseId: body.releaseId ?? null,
              position,
            },
          })
        })
        return reply.status(201).send(item)
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          return reply
            .status(409)
            .send({ error: 'Another item was added at the same time — please retry' })
        }
        throw err
      }
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
      const routeParams = parseRouteParams(ChannelSoundParamsSchema, request.params)
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
}

export default meCollectionRoutes
