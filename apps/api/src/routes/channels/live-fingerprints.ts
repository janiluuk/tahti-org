// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  LiveFingerprintsResponseSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { buildTracklistFromFingerprints } from '@tahti/shared'
import { createTrackIdentifyLookup } from '../../lib/track-identify.js'
import { getBroadcastFingerprintSegments } from '../../lib/broadcast-fingerprint.js'

const liveFingerprintsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/channels/:slug/live-fingerprints',
    {
      schema: {
        tags: ['channel'],
        description:
          'STREAM-008: chromaprint segments captured during the active live broadcast (track-boundary hints)',
        response: openApiResponse(LiveFingerprintsResponseSchema, 'LiveFingerprints'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: { id: true, state: true },
      })
      if (!channel) {
        return reply.status(404).send({ error: 'Channel not found' })
      }
      if (channel.state !== 'LIVE') {
        return reply.status(404).send({ error: 'Channel is not live' })
      }

      const broadcast = await fastify.prisma.broadcast.findFirst({
        where: { channelId: channel.id, endedAt: null },
        orderBy: { startedAt: 'desc' },
        select: { id: true },
      })
      if (!broadcast) {
        return reply.status(404).send({ error: 'No active broadcast' })
      }

      const segments = await getBroadcastFingerprintSegments(broadcast.id)
      const lookup = await createTrackIdentifyLookup()
      const tracklist =
        segments.length > 0 ? await buildTracklistFromFingerprints(segments, lookup) : []
      return reply.send({
        broadcastId: broadcast.id,
        segments,
        ...(tracklist.length > 0 ? { tracklist } : {}),
      })
    },
  )
}

export default liveFingerprintsRoute
