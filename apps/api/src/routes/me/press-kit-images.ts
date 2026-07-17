// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { nanoid } from 'nanoid'
import {
  IdParamSchema,
  PressKitGallerySettingsPatchSchema,
  PressKitGallerySettingsResponseSchema,
  PressKitImageCompleteSchema,
  PressKitImageItemSchema,
  PressKitImageListSchema,
  PressKitImagePatchSchema,
  PressKitImagePrepareResponseSchema,
  PressKitImagePrepareSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { presignedPutUrl } from '../../lib/minio.js'
import { publicMediaUrl } from '../../lib/public-media-url.js'

const PRESIGN_TTL_SEC = 900
const MAX_IMAGES = 30

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

function toItem(row: {
  id: string
  imageKey: string
  title: string | null
  position: number
  includeInZip: boolean
}) {
  return {
    id: row.id,
    imageUrl: publicMediaUrl(row.imageKey),
    title: row.title,
    position: row.position,
    includeInZip: row.includeInZip,
  }
}

const mePressKitImages: FastifyPluginAsync = async (fastify) => {
  async function ownChannel(userId: string) {
    return fastify.prisma.channel.findUnique({
      where: { userId },
      select: { id: true, slug: true },
    })
  }

  // GET /api/me/press-kit/images
  fastify.get(
    '/api/me/press-kit/images',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(PressKitImageListSchema, 'PressKitImageList') },
    },
    async (request, reply) => {
      const channel = await ownChannel(request.sessionUser!.id)
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const rows = await fastify.prisma.pressKitImage.findMany({
        where: { channelId: channel.id },
        orderBy: { position: 'asc' },
      })
      return reply.send(rows.map(toItem))
    },
  )

  // POST /api/me/press-kit/images/prepare
  fastify.post(
    '/api/me/press-kit/images/prepare',
    {
      preHandler: requireAuth,
      schema: {
        response: openApiResponse(PressKitImagePrepareResponseSchema, 'PressKitImagePrepare'),
      },
    },
    async (request, reply) => {
      const parsed = PressKitImagePrepareSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const channel = await ownChannel(request.sessionUser!.id)
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const count = await fastify.prisma.pressKitImage.count({ where: { channelId: channel.id } })
      if (count >= MAX_IMAGES) {
        return reply.status(409).send({ error: `Press kit is limited to ${MAX_IMAGES} images` })
      }

      const ext = parsed.data.filename.includes('.') ? parsed.data.filename.split('.').pop() : 'jpg'
      const uploadKey = `press-kit/${channel.slug}/${nanoid(10)}.${ext}`
      const uploadUrl = await presignedPutUrl(uploadKey, parsed.data.contentType, PRESIGN_TTL_SEC)
      const expiresAt = new Date(Date.now() + PRESIGN_TTL_SEC * 1000).toISOString()

      return reply.send({ uploadKey, uploadUrl, expiresAt })
    },
  )

  // POST /api/me/press-kit/images/complete
  fastify.post(
    '/api/me/press-kit/images/complete',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(PressKitImageItemSchema, 'PressKitImageItem') },
    },
    async (request, reply) => {
      const parsed = PressKitImageCompleteSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const channel = await ownChannel(request.sessionUser!.id)
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const prefix = `press-kit/${channel.slug}/`
      if (!parsed.data.uploadKey.startsWith(prefix)) {
        return reply.status(403).send({ error: 'Upload does not belong to this channel' })
      }

      const last = await fastify.prisma.pressKitImage.findFirst({
        where: { channelId: channel.id },
        orderBy: { position: 'desc' },
        select: { position: true },
      })

      const row = await fastify.prisma.pressKitImage.create({
        data: {
          channelId: channel.id,
          imageKey: parsed.data.uploadKey,
          title: parsed.data.title ?? null,
          position: (last?.position ?? -1) + 1,
        },
      })

      return reply.status(201).send(toItem(row))
    },
  )

  // PATCH /api/me/press-kit/images/:id
  fastify.patch(
    '/api/me/press-kit/images/:id',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(PressKitImageItemSchema, 'PressKitImageItem') },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = PressKitImagePatchSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const channel = await ownChannel(request.sessionUser!.id)
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const existing = await fastify.prisma.pressKitImage.findFirst({
        where: { id: routeParams.id, channelId: channel.id },
        select: { id: true },
      })
      if (!existing) return reply.status(404).send({ error: 'Image not found' })

      const row = await fastify.prisma.pressKitImage.update({
        where: { id: existing.id },
        data: parsed.data,
      })
      return reply.send(toItem(row))
    },
  )

  // DELETE /api/me/press-kit/images/:id
  fastify.delete(
    '/api/me/press-kit/images/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const channel = await ownChannel(request.sessionUser!.id)
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const existing = await fastify.prisma.pressKitImage.findFirst({
        where: { id: routeParams.id, channelId: channel.id },
        select: { id: true },
      })
      if (!existing) return reply.status(404).send({ error: 'Image not found' })

      await fastify.prisma.pressKitImage.delete({ where: { id: existing.id } })
      return reply.status(204).send()
    },
  )

  // GET /api/me/press-kit/gallery-settings
  fastify.get(
    '/api/me/press-kit/gallery-settings',
    {
      preHandler: requireAuth,
      schema: {
        response: openApiResponse(PressKitGallerySettingsResponseSchema, 'PressKitGallerySettings'),
      },
    },
    async (request, reply) => {
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: request.sessionUser!.id },
        select: { pressKitGalleryPublic: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      return reply.send(channel)
    },
  )

  // PATCH /api/me/press-kit/gallery-settings
  fastify.patch(
    '/api/me/press-kit/gallery-settings',
    {
      preHandler: requireAuth,
      schema: {
        response: openApiResponse(PressKitGallerySettingsResponseSchema, 'PressKitGallerySettings'),
      },
    },
    async (request, reply) => {
      const parsed = PressKitGallerySettingsPatchSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: request.sessionUser!.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const updated = await fastify.prisma.channel.update({
        where: { id: channel.id },
        data: { pressKitGalleryPublic: parsed.data.pressKitGalleryPublic },
        select: { pressKitGalleryPublic: true },
      })
      return reply.send(updated)
    },
  )
}

export default mePressKitImages
