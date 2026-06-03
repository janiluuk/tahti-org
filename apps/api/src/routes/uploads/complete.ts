// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { CompleteUploadSchema } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { enqueueTranscode } from '../../lib/queue.js'

const completeUploadRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/uploads/complete', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = CompleteUploadSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      })
    }

    const { uploadId, title } = parsed.data
    const user = request.sessionUser!

    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { id: true, slug: true },
    })

    if (!channel) {
      return reply.status(404).send({ error: 'Channel not found' })
    }

    if (!uploadId.startsWith(`raw/${channel.slug}/`)) {
      return reply.status(403).send({ error: 'Upload does not belong to your channel' })
    }

    const item = await fastify.prisma.archiveItem.create({
      data: {
        channelId: channel.id,
        title,
        rawKey: uploadId,
        fileSizeBytes: 0,
        status: 'PENDING',
      },
      select: { id: true, status: true },
    })

    await enqueueTranscode(item.id)

    return reply.status(201).send({ itemId: item.id, status: 'pending' })
  })
}

export default completeUploadRoute
