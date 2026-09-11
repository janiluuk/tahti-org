// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyInstance } from 'fastify'
import { Prisma } from '@tahti/db'
import { ChannelGalleryPatchSchema, ChannelTextLayerPatchSchema } from '@tahti/shared'

export const SOUND_LIST_ORDER_BY: Record<string, Prisma.SoundOrderByWithRelationInput> = {
  newest: { createdAt: 'desc' },
  oldest: { createdAt: 'asc' },
  title: { title: 'asc' },
  duration: { durationSec: 'desc' },
  bpm: { bpm: 'desc' },
  genre: { genre: 'asc' },
}

export async function patchChannelGallery(
  fastify: FastifyInstance,
  userId: string,
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
  const parsed = ChannelGalleryPatchSchema.safeParse(body)
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
      ...(parsed.data.videoBackgroundUrl !== undefined
        ? { videoBackgroundUrl: parsed.data.videoBackgroundUrl }
        : {}),
    },
    select: { galleryMode: true, slideshowImages: true, videoBackgroundUrl: true },
  })

  return { ok: true, ...updated }
}

export async function patchChannelTextLayer(
  fastify: FastifyInstance,
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
