// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  StatsPlaysResponseSchema,
  StatsRangeQuerySchema,
  StatsTopCountriesResponseSchema,
  StatsTopTracksResponseSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import {
  buildArtistPlaysStats,
  buildTopCountriesStats,
  buildTopTracksStats,
} from '../../lib/artist-stats.js'

/** PLAT-030: artist dashboard stats (plays, top tracks, referer countries). */
const meStatsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/stats/plays',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'PLAT-030: plays time series (downloads + smart-link clicks)',
        response: openApiResponse(StatsPlaysResponseSchema, 'StatsPlays'),
      },
    },
    async (request, reply) => {
      const raw = (request.query as { range?: string }).range
      const parsed = StatsRangeQuerySchema.safeParse(raw ?? '30')
      const range = parsed.success ? parsed.data : '30'
      const user = request.sessionUser!
      return reply.send(await buildArtistPlaysStats(fastify.prisma, user.id, range))
    },
  )

  fastify.get(
    '/api/me/stats/top-tracks',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'PLAT-030: top archive tracks by counted downloads',
        response: openApiResponse(StatsTopTracksResponseSchema, 'StatsTopTracks'),
      },
    },
    async (request, reply) => {
      const raw = (request.query as { range?: string }).range
      const parsed = StatsRangeQuerySchema.safeParse(raw ?? 'all')
      const range = parsed.success ? parsed.data : 'all'
      const user = request.sessionUser!
      return reply.send(await buildTopTracksStats(fastify.prisma, user.id, range))
    },
  )

  fastify.get(
    '/api/me/stats/top-countries',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'PLAT-030: top referer countries from smart-link clicks',
        response: openApiResponse(StatsTopCountriesResponseSchema, 'StatsTopCountries'),
      },
    },
    async (request, reply) => {
      const raw = (request.query as { range?: string }).range
      const parsed = StatsRangeQuerySchema.safeParse(raw ?? 'all')
      const range = parsed.success ? parsed.data : 'all'
      const user = request.sessionUser!
      return reply.send(await buildTopCountriesStats(fastify.prisma, user.id, range))
    },
  )
}

export default meStatsRoutes
