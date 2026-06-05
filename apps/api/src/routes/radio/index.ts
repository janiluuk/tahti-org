// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { RadioFeatureHistorySchema, RadioNowPlayingSchema, openApiResponse } from '@tahti/shared'
import { getRadioFeatureHistory } from '../../lib/radio-feature.js'

const RADIO_URL = process.env.RADIO_SERVICE_URL ?? 'http://tahti-radio:3004'

// M16 — public Tahti Radio now-playing endpoint
const radioRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/radio',
    {
      schema: {
        tags: ['radio'],
        description: 'M16: Tahti Radio now-playing (proxied from tahti-radio service)',
        response: openApiResponse(RadioNowPlayingSchema, 'RadioNowPlaying'),
      },
    },
    async (_request, reply) => {
      try {
        const res = await fetch(`${RADIO_URL}/now-playing`, { signal: AbortSignal.timeout(2000) })
        const data = (await res.json()) as unknown
        return reply.send(data)
      } catch {
        // Radio service unreachable — return offline state rather than 500
        return reply.send({ live: false, channel: null })
      }
    },
  )

  fastify.get(
    '/api/v1/radio/history',
    {
      schema: {
        tags: ['radio'],
        description: 'M16: last featured channels on Tahti Radio',
        response: openApiResponse(RadioFeatureHistorySchema, 'RadioFeatureHistory'),
      },
    },
    async (_request, reply) => {
      const history = await getRadioFeatureHistory(fastify.prisma, 10)
      return reply.send(history)
    },
  )
}

export default radioRoutes
