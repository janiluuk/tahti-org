// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { ChannelGalleryPatchSchema, ChannelTextLayerPatchSchema } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import {
  archiveItemMetadataSelect,
  metadataPatchFromBody,
  serializeArchiveItem,
} from '../../lib/archive-metadata.js'

const meArchiveRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/me/archive', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!channel) return reply.send([])

    const items = await fastify.prisma.archiveItem.findMany({
      where: { channelId: channel.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: archiveItemMetadataSelect,
    })
    return reply.send(items.map((i) => serializeArchiveItem(i)))
  })

  fastify.get('/api/me/archive/:id', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const { id } = request.params as { id: string }

    const item = await fastify.prisma.archiveItem.findFirst({
      where: { id, channel: { userId: user.id } },
      select: archiveItemMetadataSelect,
    })
    if (!item) return reply.status(404).send({ error: 'Archive item not found' })
    return reply.send(serializeArchiveItem(item))
  })

  fastify.patch('/api/me/archive/:id', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const { id } = request.params as { id: string }

    const item = await fastify.prisma.archiveItem.findFirst({
      where: { id, channel: { userId: user.id } },
      select: { id: true },
    })
    if (!item) return reply.status(404).send({ error: 'Archive item not found' })

    const patch = metadataPatchFromBody(request.body)
    if (!patch.ok) return reply.status(400).send({ error: patch.error })

    if (patch.title !== undefined) {
      const t = patch.title.trim()
      if (!t) return reply.status(400).send({ error: 'title cannot be empty' })
      patch.data.title = t.slice(0, 200)
    }

    const updated = await fastify.prisma.archiveItem.update({
      where: { id },
      data: patch.data,
      select: archiveItemMetadataSelect,
    })

    return reply.send(serializeArchiveItem(updated))
  })

  fastify.get('/api/me/channel/gallery', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { galleryMode: true, slideshowImages: true },
    })
    if (!channel) return reply.status(404).send({ error: 'Channel not found' })
    return reply.send(channel)
  })

  async function patchChannelGallery(
    userId: string,
    body: unknown,
  ): Promise<
    | { ok: true; galleryMode: string; slideshowImages: string[] }
    | { ok: false; status: number; error: string }
  > {
    const parsed = ChannelGalleryPatchSchema.safeParse(body)
    if (!parsed.success) {
      return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? 'Invalid body' }
    }
    if (parsed.data.galleryMode === undefined && parsed.data.slideshowImages === undefined) {
      return { ok: false, status: 400, error: 'galleryMode or slideshowImages required' }
    }

    const channel = await fastify.prisma.channel.findUnique({
      where: { userId },
      select: { id: true },
    })
    if (!channel) return { ok: false, status: 404, error: 'Channel not found' }

    const updated = await fastify.prisma.channel.update({
      where: { id: channel.id },
      data: {
        ...(parsed.data.galleryMode !== undefined ? { galleryMode: parsed.data.galleryMode } : {}),
        ...(parsed.data.slideshowImages !== undefined
          ? { slideshowImages: parsed.data.slideshowImages }
          : {}),
      },
      select: { galleryMode: true, slideshowImages: true },
    })

    return { ok: true, ...updated }
  }

  fastify.patch('/api/me/channel/gallery', { preHandler: requireAuth }, async (request, reply) => {
    const result = await patchChannelGallery(request.sessionUser!.id, request.body)
    if (!result.ok) return reply.status(result.status).send({ error: result.error })
    return reply.send({
      galleryMode: result.galleryMode,
      slideshowImages: result.slideshowImages,
    })
  })

  fastify.patch(
    '/api/me/channel/slideshow',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const body = request.body as { slideshowImages?: unknown; galleryMode?: unknown }

      if (body.slideshowImages !== undefined && !Array.isArray(body.slideshowImages)) {
        return reply.status(400).send({ error: 'slideshowImages must be an array' })
      }

      const result = await patchChannelGallery(user.id, {
        ...(body.slideshowImages !== undefined
          ? {
              slideshowImages: (body.slideshowImages as unknown[])
                .filter((u) => typeof u === 'string')
                .slice(0, 10) as string[],
            }
          : {}),
        ...(typeof body.galleryMode === 'string' ? { galleryMode: body.galleryMode } : {}),
      })
      if (!result.ok) return reply.status(result.status).send({ error: result.error })
      return reply.send({ slideshowImages: result.slideshowImages })
    },
  )

  fastify.get('/api/me/channel/text-layer', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { textLayerMode: true, textLayerText: true, textLayerAlign: true },
    })
    if (!channel) return reply.status(404).send({ error: 'Channel not found' })
    return reply.send(channel)
  })

  async function patchChannelTextLayer(
    userId: string,
    body: unknown,
  ): Promise<
    | { ok: true; textLayerMode: string; textLayerText: string; textLayerAlign: string }
    | { ok: false; status: number; error: string }
  > {
    const parsed = ChannelTextLayerPatchSchema.safeParse(body)
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

    const channel = await fastify.prisma.channel.findUnique({
      where: { userId },
      select: { id: true, textLayerMode: true, textLayerText: true, textLayerAlign: true },
    })
    if (!channel) return { ok: false, status: 404, error: 'Channel not found' }

    const nextMode = parsed.data.textLayerMode ?? channel.textLayerMode
    const nextText =
      parsed.data.textLayerText !== undefined ? parsed.data.textLayerText : channel.textLayerText
    if (nextMode !== 'NONE' && nextText.trim().length === 0) {
      return {
        ok: false,
        status: 400,
        error: 'textLayerText is required when a text effect is enabled',
      }
    }

    const updated = await fastify.prisma.channel.update({
      where: { id: channel.id },
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
    '/api/me/channel/text-layer',
    { preHandler: requireAuth },
    async (request, reply) => {
      const result = await patchChannelTextLayer(request.sessionUser!.id, request.body)
      if (!result.ok) return reply.status(result.status).send({ error: result.error })
      return reply.send({
        textLayerMode: result.textLayerMode,
        textLayerText: result.textLayerText,
        textLayerAlign: result.textLayerAlign,
      })
    },
  )
}

export default meArchiveRoutes
