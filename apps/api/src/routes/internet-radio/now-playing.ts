// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { createHash } from 'node:crypto'
import {
  InternetRadioNowPlayingQuerySchema,
  InternetRadioNowPlayingSchema,
  fetchNowPlaying,
  openApiResponse,
  parserForUrl,
} from '@tahti/shared'
import { getCachedJson } from '../../lib/json-cache.js'

// One fetch per station page per minute, however many listeners ask.
const CACHE_SECONDS = 60

const internetRadioNowPlayingRoute: FastifyPluginAsync = async (fastify) => {
  // Public (no auth) — what a catalog station is playing, read from the
  // station's own programme page. Only pages on hosts we have a parser for
  // are ever fetched, so this cannot be pointed at an arbitrary address.
  fastify.get(
    '/api/v1/internet-radio/now-playing',
    {
      schema: {
        tags: ['internet-radio'],
        description: 'Current programme and track of a radio station, from its programme page',
        response: openApiResponse(InternetRadioNowPlayingSchema, 'InternetRadioNowPlaying'),
      },
    },
    async (request, reply) => {
      const parsed = InternetRadioNowPlayingQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'A station programme url is required' })
      }
      const { url } = parsed.data
      if (!url.startsWith('https://') || !parserForUrl(url)) {
        return reply.status(404).send({ error: 'No now-playing source for this station' })
      }

      const key = createHash('sha256').update(url).digest('hex').slice(0, 32)
      const nowPlaying = await getCachedJson(
        `internet-radio:now-playing:${key}`,
        CACHE_SECONDS,
        async () => (await fetchNowPlaying(url)) ?? { title: null, artist: null },
      )
      reply.header('Cache-Control', `public, max-age=${CACHE_SECONDS}`)
      return reply.send(nowPlaying)
    },
  )
}

export default internetRadioNowPlayingRoute
