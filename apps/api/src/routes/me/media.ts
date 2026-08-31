// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { nanoid } from 'nanoid'
import {
  ImageUploadPrepareResponseSchema,
  ImageUploadPrepareSchema,
  UserMediaCompleteSchema,
  UserMediaFileSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { presignedPutUrl } from '../../lib/minio.js'
import { publicMediaUrl } from '../../lib/public-media-url.js'

const PRESIGN_TTL_SEC = 900

/** Generic "my media" upload — backs `ImageUploadField`/`uploadUserMediaFile` on the
 * client, used wherever a feature needs an ad hoc image (radio widget cover art,
 * channel backdrops, stream overlay images) without its own dedicated attach
 * endpoint. No DB row: the object key itself is the identity, nothing lists these
 * back server-side today. */
const meMediaRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/me/media/prepare',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ImageUploadPrepareResponseSchema, 'UserMediaPrepare'),
      },
    },
    async (request, reply) => {
      const parsed = ImageUploadPrepareSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const user = request.sessionUser!

      const ext = parsed.data.filename.includes('.') ? parsed.data.filename.split('.').pop() : 'jpg'
      const uploadKey = `media/${user.username}/${nanoid(10)}.${ext}`
      const uploadUrl = await presignedPutUrl(uploadKey, parsed.data.contentType, PRESIGN_TTL_SEC)
      const expiresAt = new Date(Date.now() + PRESIGN_TTL_SEC * 1000).toISOString()

      return reply.send({ uploadKey, uploadUrl, expiresAt })
    },
  )

  fastify.post(
    '/api/me/media/complete',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(UserMediaFileSchema, 'UserMediaComplete'),
      },
    },
    async (request, reply) => {
      const parsed = UserMediaCompleteSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const user = request.sessionUser!

      const prefix = `media/${user.username}/`
      if (!parsed.data.uploadKey.startsWith(prefix)) {
        return reply.status(403).send({ error: 'Upload does not belong to this account' })
      }

      const url = publicMediaUrl(parsed.data.uploadKey)
      if (!url) {
        return reply.status(500).send({ error: 'Failed to resolve media URL' })
      }

      return reply.send({
        id: parsed.data.uploadKey,
        filename: parsed.data.filename,
        contentType: parsed.data.contentType,
        sizeBytes: parsed.data.sizeBytes,
        url,
        createdAt: new Date().toISOString(),
      })
    },
  )
}

export default meMediaRoutes
