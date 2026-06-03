// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { mediaQueue } from '../../lib/queue.js'

// M7 — Mixcloud upload for archive items (mixes)
const mixcloudRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/me/archive/:itemId/mixcloud — queue a mix for Mixcloud upload
  fastify.post(
    '/api/me/archive/:itemId/mixcloud',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const { itemId } = request.params as { itemId: string }

      const item = await fastify.prisma.archiveItem.findFirst({
        where: { id: itemId, channel: { userId: user.id } },
        select: { id: true, status: true, mp3Key: true, rawKey: true, mixUpload: true },
      })

      if (!item) return reply.status(404).send({ error: 'Archive item not found' })
      if (item.status !== 'READY') {
        return reply.status(409).send({ error: 'Archive item is not ready for upload' })
      }
      if (item.mixUpload) {
        return reply.status(409).send({
          error: 'Already queued',
          status: item.mixUpload.status,
          mixcloudUrl: item.mixUpload.mixcloudUrl,
        })
      }

      const upload = await fastify.prisma.mixUpload.create({
        data: { userId: user.id, archiveItemId: itemId, status: 'PENDING' },
      })

      await mediaQueue.add('mixcloud-upload', { mixUploadId: upload.id })

      return reply.status(202).send({ mixUploadId: upload.id, status: 'pending' })
    },
  )

  // GET /api/me/archive/:itemId/mixcloud — check upload status
  fastify.get(
    '/api/me/archive/:itemId/mixcloud',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const { itemId } = request.params as { itemId: string }

      const item = await fastify.prisma.archiveItem.findFirst({
        where: { id: itemId, channel: { userId: user.id } },
        select: { mixUpload: true },
      })

      if (!item) return reply.status(404).send({ error: 'Archive item not found' })
      if (!item.mixUpload) return reply.status(404).send({ error: 'No Mixcloud upload found' })

      return reply.send({
        status: item.mixUpload.status,
        mixcloudUrl: item.mixUpload.mixcloudUrl,
        error: item.mixUpload.error,
        completedAt: item.mixUpload.completedAt,
      })
    },
  )
}

export default mixcloudRoutes
