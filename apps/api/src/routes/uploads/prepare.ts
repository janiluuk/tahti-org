// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

import type { FastifyPluginAsync } from 'fastify'
import { nanoid } from 'nanoid'
import { PrepareUploadSchema } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { presignedPutUrl } from '../../lib/minio.js'

const PRESIGN_TTL_SEC = 900

const prepareUploadRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/uploads/prepare', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = PrepareUploadSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation error',
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      })
    }

    const { filename, contentType, title } = parsed.data
    const user = request.sessionUser!

    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { slug: true },
    })

    if (!channel) {
      return reply.status(404).send({ error: 'Channel not found' })
    }

    const ext = filename.includes('.') ? filename.split('.').pop() : 'mp3'
    const uploadId = `raw/${channel.slug}/${nanoid(16)}.${ext}`

    const uploadUrl = await presignedPutUrl(uploadId, contentType, PRESIGN_TTL_SEC)
    const expiresAt = new Date(Date.now() + PRESIGN_TTL_SEC * 1000).toISOString()

    return reply.status(200).send({ uploadId, uploadUrl, expiresAt, title })
  })
}

export default prepareUploadRoute
