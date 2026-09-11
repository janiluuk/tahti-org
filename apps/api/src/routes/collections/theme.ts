// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  CollectionGalleryPatchSchema,
  CollectionTextLayerPatchSchema,
  SlugParamSchema,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

export const collectionThemeRoutes: FastifyPluginAsync = async (fastify) => {
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
}
