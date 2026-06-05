// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  BroadcastFingerprintSegmentBodySchema,
  BroadcastIdParamSchema,
  ChatOkResponseSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { config } from '../../config.js'
import { appendBroadcastFingerprintSegment } from '../../lib/broadcast-fingerprint.js'

const broadcastFingerprintInternalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/internal/broadcast/:broadcastId/fingerprint-segment',
    {
      schema: {
        tags: ['internal'],
        description: 'STREAM-008: ingest sidecar posts chromaprint segments during live broadcast',
        response: openApiResponse(ChatOkResponseSchema, 'ChatOkResponse'),
      },
    },
    async (request, reply) => {
      const authHeader = request.headers.authorization
      if (authHeader !== `Bearer ${config.internalSecret}`) {
        return reply.status(401).send({ error: 'Unauthorized' })
      }

      const routeParams = parseRouteParams(BroadcastIdParamSchema, request.params)
      if (!routeParams) {
        return reply.status(400).send({ error: 'Invalid path parameters' })
      }

      const parsed = BroadcastFingerprintSegmentBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const broadcast = await fastify.prisma.broadcast.findUnique({
        where: { id: routeParams.broadcastId },
        select: { id: true, endedAt: true },
      })
      if (!broadcast) {
        return reply.status(404).send({ error: 'Broadcast not found' })
      }
      if (broadcast.endedAt) {
        return reply.status(409).send({ error: 'Broadcast ended' })
      }

      await appendBroadcastFingerprintSegment(routeParams.broadcastId, {
        ...parsed.data,
        durationSec: parsed.data.durationSec ?? 12,
      })
      return reply.send({ ok: true })
    },
  )
}

export default broadcastFingerprintInternalRoutes
