// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  InsightsPeriodQuerySchema,
  TrackInsightsResponseSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { buildArchiveItemInsights, buildReleaseTrackInsights } from '../../lib/track-insights.js'

const meTrackInsightsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/archive/:id/insights — per-track stats for an ArchiveItem
  fastify.get(
    '/api/me/archive/:id/insights',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M37: per-track insights (downloads, geo, daily) for an archive item',
        response: openApiResponse(TrackInsightsResponseSchema, 'TrackInsights'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsedPeriod = InsightsPeriodQuerySchema.safeParse(
        (request.query as { period?: string }).period,
      )
      const period = parsedPeriod.success ? parsedPeriod.data : '30d'
      const user = request.sessionUser!

      const insights = await buildArchiveItemInsights(
        fastify.prisma,
        user.id,
        routeParams.id,
        period,
      )
      if (!insights) return reply.status(404).send({ error: 'Track not found' })
      return reply.send(insights)
    },
  )

  // GET /api/me/release-tracks/:id/insights — per-track stats for a ReleaseTrack
  fastify.get(
    '/api/me/release-tracks/:id/insights',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        description: 'M37: per-track insights (downloads, geo, daily) for a release track',
        response: openApiResponse(TrackInsightsResponseSchema, 'ReleaseTrackInsights'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsedPeriod = InsightsPeriodQuerySchema.safeParse(
        (request.query as { period?: string }).period,
      )
      const period = parsedPeriod.success ? parsedPeriod.data : '30d'
      const user = request.sessionUser!

      const insights = await buildReleaseTrackInsights(
        fastify.prisma,
        user.id,
        routeParams.id,
        period,
      )
      if (!insights) return reply.status(404).send({ error: 'Track not found' })
      return reply.send(insights)
    },
  )
}

export default meTrackInsightsRoutes
