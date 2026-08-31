// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { nanoid } from 'nanoid'
import {
  ChannelBackdropUploadCompleteResponseSchema,
  ChannelBackdropUploadCompleteSchema,
  ChannelBackdropUploadPrepareSchema,
  ImageUploadPrepareResponseSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { presignedPutUrl } from '../../lib/minio.js'
import { publicMediaUrl } from '../../lib/public-media-url.js'

const PRESIGN_TTL_SEC = 900

/** Channel header backdrop upload (Channel Designer's "Video or image
 * backdrop" picker) — the one upload slot that accepts either a short video
 * loop or a static image into the same `Channel.videoBackgroundUrl` column.
 * No DB write here: the client persists the resulting URL itself via the
 * existing `PATCH /api/me/channel/visual` (ChannelVisualPatchSchema), which
 * enforces the direct-video-file requirement only when headerStyle is
 * VIDEO_LOOP. */
const meChannelBackdropRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/me/channel/video-background/prepare',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ImageUploadPrepareResponseSchema, 'ChannelBackdropUploadPrepare'),
      },
    },
    async (request, reply) => {
      const parsed = ChannelBackdropUploadPrepareSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const user = request.sessionUser!

      const ext = parsed.data.filename.includes('.') ? parsed.data.filename.split('.').pop() : 'mp4'
      const uploadKey = `channel-backdrops/${user.username}/${nanoid(10)}.${ext}`
      const uploadUrl = await presignedPutUrl(uploadKey, parsed.data.contentType, PRESIGN_TTL_SEC)
      const expiresAt = new Date(Date.now() + PRESIGN_TTL_SEC * 1000).toISOString()

      return reply.send({ uploadKey, uploadUrl, expiresAt })
    },
  )

  fastify.post(
    '/api/me/channel/video-background/complete',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ChannelBackdropUploadCompleteResponseSchema, 'ChannelBackdropUploadComplete'),
      },
    },
    async (request, reply) => {
      const parsed = ChannelBackdropUploadCompleteSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const user = request.sessionUser!

      const prefix = `channel-backdrops/${user.username}/`
      if (!parsed.data.uploadKey.startsWith(prefix)) {
        return reply.status(403).send({ error: 'Upload does not belong to this account' })
      }

      const videoBackgroundUrl = publicMediaUrl(parsed.data.uploadKey)
      if (!videoBackgroundUrl) {
        return reply.status(500).send({ error: 'Failed to resolve backdrop URL' })
      }

      return reply.send({ videoBackgroundUrl })
    },
  )
}

export default meChannelBackdropRoutes
