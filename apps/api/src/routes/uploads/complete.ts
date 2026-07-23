// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { CompleteUploadResponseSchema, CompleteUploadSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { enqueueTranscode } from '../../lib/queue.js'
import { metadataForNewUpload } from '../../lib/archive-metadata.js'
import { headObjectSize } from '../../lib/minio.js'
import { MAX_FALLBACK_ITEMS, fallbackCount } from '../../lib/fallback-rotation.js'

const completeUploadRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/uploads/complete',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Finalize upload and enqueue transcode',
        response: openApiResponse(CompleteUploadResponseSchema, 'CompleteUpload'),
      },
    },
    async (request, reply) => {
      const parsed = CompleteUploadSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation error',
          issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
        })
      }

      const { uploadId, title, metadata, source } = parsed.data
      const user = request.sessionUser!

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: {
          id: true,
          slug: true,
          fallbackAutoEnroll: true,
          user: { select: { defaultTrackCommentsEnabled: true } },
        },
      })

      if (!channel) {
        return reply.status(404).send({ error: 'Channel not found' })
      }

      if (!uploadId.startsWith(`raw/${channel.slug}/`)) {
        return reply.status(403).send({ error: 'Upload does not belong to your channel' })
      }

      const fileSizeBytes = (await headObjectSize(uploadId)) ?? 0

      // Auto-join the 24/7 rotation on upload unless the artist opted out or the
      // rotation is already at capacity — no swap-confirm UX makes sense for an
      // unattended upload, so this silently skips enrollment rather than evicting.
      // An explicit isFallback in the request always wins over the auto default.
      const autoEnrollData =
        metadata?.isFallback === undefined
          ? {
              isFallback:
                channel.fallbackAutoEnroll &&
                (await fallbackCount(fastify.prisma, channel.id)) < MAX_FALLBACK_ITEMS,
            }
          : {}

      const item = await fastify.prisma.archiveItem.create({
        data: {
          channelId: channel.id,
          title,
          rawKey: uploadId,
          fileSizeBytes,
          status: 'PENDING',
          ...(source ? { source } : {}),
          ...metadataForNewUpload(metadata),
          ...autoEnrollData,
          // Always the account default at creation time — commentsEnabled isn't
          // client-settable until the track exists (PATCH /api/me/archive/:id).
          commentsEnabled: channel.user.defaultTrackCommentsEnabled,
        },
        select: { id: true, status: true },
      })

      await enqueueTranscode(item.id)

      return reply.status(201).send({ itemId: item.id, status: 'pending' })
    },
  )
}

export default completeUploadRoute
