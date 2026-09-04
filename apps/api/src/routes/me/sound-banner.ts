// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { nanoid } from 'nanoid'
import {
  IdParamSchema,
  ImageFromUrlSchema,
  ImageUploadCompleteSchema,
  ImageUploadCompleteResponseSchema,
  ImageUploadPrepareSchema,
  ImageUploadPrepareResponseSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { presignedPutUrl, putObjectBuffer } from '../../lib/minio.js'
import { publicMediaUrl } from '../../lib/public-media-url.js'
import { extFromMime, fetchImageFromUrl } from '../../lib/fetch-image-url.js'

const PRESIGN_TTL_SEC = 900

const soundBannerRoutes: FastifyPluginAsync = async (fastify) => {
  async function ownedItem(userId: string, itemId: string) {
    return fastify.prisma.sound.findFirst({
      where: { id: itemId, channel: { userId } },
      select: { id: true, channel: { select: { user: { select: { username: true } } } } },
    })
  }

  fastify.post(
    '/api/me/sound/:id/banner/prepare',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ImageUploadPrepareResponseSchema, 'SoundBannerPrepare'),
      },
    },
    async (request, reply) => {
      const parsed = ImageUploadPrepareSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const item = await ownedItem(user.id, id)
      if (!item) return reply.status(404).send({ error: 'Sound item not found' })

      const ext = parsed.data.filename.includes('.') ? parsed.data.filename.split('.').pop() : 'jpg'
      const uploadKey = `sound/${item.channel.user.username}/${id}/banner-${nanoid(8)}.${ext}`
      const uploadUrl = await presignedPutUrl(uploadKey, parsed.data.contentType, PRESIGN_TTL_SEC)
      const expiresAt = new Date(Date.now() + PRESIGN_TTL_SEC * 1000).toISOString()

      return reply.send({ uploadKey, uploadUrl, expiresAt })
    },
  )

  fastify.post(
    '/api/me/sound/:id/banner/complete',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ImageUploadCompleteResponseSchema, 'SoundBannerComplete'),
      },
    },
    async (request, reply) => {
      const parsed = ImageUploadCompleteSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const item = await ownedItem(user.id, id)
      if (!item) return reply.status(404).send({ error: 'Sound item not found' })

      const prefix = `sound/${item.channel.user.username}/${id}/`
      if (!parsed.data.uploadKey.startsWith(prefix)) {
        return reply.status(403).send({ error: 'Upload does not belong to this item' })
      }

      const url = publicMediaUrl(parsed.data.uploadKey)
      await fastify.prisma.sound.update({ where: { id }, data: { bannerUrl: url } })
      return reply.send({ url })
    },
  )

  fastify.post(
    '/api/me/sound/:id/banner/from-url',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ImageUploadCompleteResponseSchema, 'SoundBannerFromUrl'),
      },
    },
    async (request, reply) => {
      const parsed = ImageFromUrlSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const item = await ownedItem(user.id, id)
      if (!item) return reply.status(404).send({ error: 'Sound item not found' })

      const fetched = await fetchImageFromUrl(parsed.data.sourceUrl)
      if (!fetched.ok) return reply.status(422).send({ error: fetched.error })

      const uploadKey = `sound/${item.channel.user.username}/${id}/banner-${nanoid(8)}.${extFromMime(fetched.contentType)}`
      await putObjectBuffer(uploadKey, fetched.bytes, fetched.contentType)

      const url = publicMediaUrl(uploadKey)
      await fastify.prisma.sound.update({ where: { id }, data: { bannerUrl: url } })
      return reply.send({ url })
    },
  )
}

export default soundBannerRoutes
