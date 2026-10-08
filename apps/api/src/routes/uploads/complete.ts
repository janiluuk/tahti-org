// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { soundDefaultsFromOwner } from '@tahti/db'
import { CompleteUploadResponseSchema, CompleteUploadSchema, openApiResponses } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { enqueueTranscode } from '../../lib/queue.js'
import { metadataForNewUpload } from '../../lib/sound-metadata.js'
import { UNKNOWN_VENUE_BODY, canAttachVenue } from '../../lib/sound-venue.js'
import { headObjectSize } from '../../lib/minio.js'
import { MAX_FALLBACK_ITEMS, fallbackCount } from '../../lib/fallback-rotation.js'
import { auditLog } from '../../lib/audit.js'

const completeUploadRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/uploads/complete',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        summary: 'Complete a local audio upload',
        description:
          'Creates the Sound and enqueues transcode after the presigned PUT. Answers 201. Follows POST /api/uploads/prepare.',
        response: openApiResponses([
          { status: 201, schema: CompleteUploadResponseSchema, name: 'CompleteUpload' },
        ]),
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
          user: { select: { defaultTrackCommentsEnabled: true, topListsOptOut: true } },
        },
      })

      if (!channel) {
        return reply.status(404).send({ error: 'Channel not found' })
      }

      if (!uploadId.startsWith(`raw/${channel.slug}/`)) {
        return reply.status(403).send({ error: 'Upload does not belong to your channel' })
      }

      if (metadata?.venueId && !(await canAttachVenue(fastify.prisma, metadata.venueId, user.id))) {
        return reply.status(400).send(UNKNOWN_VENUE_BODY)
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

      const item = await fastify.prisma.sound.create({
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
          // client-settable until the track exists (PATCH /api/me/sound/:id).
          ...soundDefaultsFromOwner(channel.user),
        },
        select: { id: true, status: true },
      })

      void auditLog(fastify.prisma, {
        action: 'CONTENT_UPLOAD',
        actorId: user.id,
        targetId: item.id,
        meta: { title },
      })

      await enqueueTranscode(item.id)

      return reply.status(201).send({ itemId: item.id, status: 'pending' })
    },
  )
}

export default completeUploadRoute
