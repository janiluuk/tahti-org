// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  StatsPlaysResponseSchema,
  StatsRangeQuerySchema,
  StatsSummaryResponseSchema,
  StatsTopCountriesResponseSchema,
  StatsTopTracksResponseSchema,
  TopListDimensionSchema,
  TopListPeriodSchema,
  TopListSortSchema,
  TopListsByDimensionResponseSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import {
  buildArtistPlaysStats,
  buildDashboardPlayDownloadCounters,
  buildTopCountriesStats,
  buildTopTracksStats,
} from '../../lib/artist-stats.js'
import { buildTopListsByDimension, periodSince } from '../../lib/top-lists.js'

/** PLAT-030: artist dashboard stats (plays, top tracks, referer countries). */
const meStatsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/stats/summary',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Dashboard KPI counters: plays/downloads today + all-time',
        response: openApiResponse(StatsSummaryResponseSchema, 'StatsSummary'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      return reply.send(await buildDashboardPlayDownloadCounters(fastify.prisma, user.id))
    },
  )

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
        description: 'PLAT-030: top sound tracks by counted downloads',
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
    '/api/me/stats/top-lists',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: "Artist's own listening top lists, grouped by type or genre",
        response: openApiResponse(TopListsByDimensionResponseSchema, 'ArtistTopLists'),
      },
    },
    async (request, reply) => {
      const query = request.query as Record<string, unknown>
      const period = TopListPeriodSchema.safeParse(query.period ?? 'month')
      const dimension = TopListDimensionSchema.safeParse(query.dimension ?? 'type')
      const sort = TopListSortSchema.safeParse(query.sort ?? 'desc')
      if (!period.success) return reply.status(400).send({ error: 'Invalid period' })
      if (!dimension.success) return reply.status(400).send({ error: 'Invalid dimension' })
      if (!sort.success) return reply.status(400).send({ error: 'Invalid sort' })

      const user = request.sessionUser!
      const buckets = await buildTopListsByDimension(fastify.prisma, {
        since: periodSince(period.data),
        dimension: dimension.data,
        sort: sort.data,
        userId: user.id,
      })
      return reply.send({
        period: period.data,
        dimension: dimension.data,
        sort: sort.data,
        buckets,
      })
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
