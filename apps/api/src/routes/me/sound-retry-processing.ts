// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  SoundRetryProcessingSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { enqueueTranscode } from '../../lib/queue.js'

const meSoundRetryProcessingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/me/sound/:id/retry-processing',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Run processing again for a sound whose upload failed (status ERROR)',
        response: openApiResponse(SoundRetryProcessingSchema, 'SoundRetryProcessing'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const item = await fastify.prisma.sound.findFirst({
        where: { id, channel: { userId: user.id } },
        select: { id: true, rawKey: true },
      })
      if (!item) return reply.status(404).send({ error: 'Sound item not found' })
      if (!item.rawKey) {
        return reply.status(409).send({ error: 'This sound has no uploaded file to process' })
      }

      // Conditional on ERROR so a double click or a second tab enqueues only one job.
      const { count } = await fastify.prisma.sound.updateMany({
        where: { id: item.id, status: 'ERROR' },
        data: { status: 'PENDING', processingError: null },
      })
      if (count === 0) {
        return reply
          .status(409)
          .send({ error: 'Only a sound that failed processing can be retried' })
      }

      await enqueueTranscode(item.id)
      return reply.send({ id: item.id, status: 'PENDING' as const })
    },
  )
}

export default meSoundRetryProcessingRoutes
