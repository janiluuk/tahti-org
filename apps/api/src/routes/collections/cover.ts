// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { nanoid } from 'nanoid'
import {
  ImageFromUrlSchema,
  ImageUploadCompleteSchema,
  ImageUploadCompleteResponseSchema,
  ImageUploadPrepareSchema,
  ImageUploadPrepareResponseSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { presignedGetUrl, presignedPutUrl, putObjectBuffer } from '../../lib/minio.js'
import { extFromMime, fetchImageFromUrl } from '../../lib/fetch-image-url.js'

const COVER_PRESIGN_SEC = 3600

const PRESIGN_TTL_SEC = 900

const collectionCoverRoutes: FastifyPluginAsync = async (fastify) => {
  async function ownedCollection(userId: string, slug: string) {
    return fastify.prisma.collection.findFirst({
      where: { slug, userId },
      select: { id: true, slug: true, user: { select: { username: true } } },
    })
  }

  fastify.post(
    '/api/me/collections/:slug/cover/prepare',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        response: openApiResponse(ImageUploadPrepareResponseSchema, 'CollectionCoverPrepare'),
      },
    },
    async (request, reply) => {
      const parsed = ImageUploadPrepareSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const user = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const col = await ownedCollection(user.id, routeParams.slug)
      if (!col) return reply.status(404).send({ error: 'Collection not found' })

      const ext = parsed.data.filename.includes('.') ? parsed.data.filename.split('.').pop() : 'jpg'
      const uploadKey = `collections/${col.user.username}/${col.slug}/cover-${nanoid(8)}.${ext}`
      const uploadUrl = await presignedPutUrl(uploadKey, parsed.data.contentType, PRESIGN_TTL_SEC)
      const expiresAt = new Date(Date.now() + PRESIGN_TTL_SEC * 1000).toISOString()

      return reply.send({ uploadKey, uploadUrl, expiresAt })
    },
  )

  fastify.post(
    '/api/me/collections/:slug/cover/complete',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        response: openApiResponse(ImageUploadCompleteResponseSchema, 'CollectionCoverComplete'),
      },
    },
    async (request, reply) => {
      const parsed = ImageUploadCompleteSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const user = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const col = await ownedCollection(user.id, routeParams.slug)
      if (!col) return reply.status(404).send({ error: 'Collection not found' })

      const prefix = `collections/${col.user.username}/${col.slug}/`
      if (!parsed.data.uploadKey.startsWith(prefix)) {
        return reply.status(403).send({ error: 'Upload does not belong to this collection' })
      }

      await fastify.prisma.collection.update({
        where: { id: col.id },
        data: { coverKey: parsed.data.uploadKey, coverUrl: null },
      })
      const url = await presignedGetUrl(parsed.data.uploadKey, COVER_PRESIGN_SEC)
      return reply.send({ url })
    },
  )

  fastify.post(
    '/api/me/collections/:slug/cover/from-url',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        response: openApiResponse(ImageUploadCompleteResponseSchema, 'CollectionCoverFromUrl'),
      },
    },
    async (request, reply) => {
      const parsed = ImageFromUrlSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const user = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const col = await ownedCollection(user.id, routeParams.slug)
      if (!col) return reply.status(404).send({ error: 'Collection not found' })

      const fetched = await fetchImageFromUrl(parsed.data.sourceUrl)
      if (!fetched.ok) return reply.status(422).send({ error: fetched.error })

      const uploadKey = `collections/${col.user.username}/${col.slug}/cover-${nanoid(8)}.${extFromMime(fetched.contentType)}`
      await putObjectBuffer(uploadKey, fetched.bytes, fetched.contentType)

      await fastify.prisma.collection.update({
        where: { id: col.id },
        data: { coverKey: uploadKey, coverUrl: null },
      })
      const url = await presignedGetUrl(uploadKey, COVER_PRESIGN_SEC)
      return reply.send({ url })
    },
  )
}

export default collectionCoverRoutes
