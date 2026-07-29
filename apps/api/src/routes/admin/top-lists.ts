// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  TopListDimensionSchema,
  TopListPeriodSchema,
  TopListSortSchema,
  TopListsByDimensionResponseSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { buildTopListsByDimension, periodSince } from '../../lib/top-lists.js'

const adminTopListsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/admin/top-lists?period=month&dimension=type
  fastify.get(
    '/api/admin/top-lists',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(TopListsByDimensionResponseSchema, 'TopListsByDimension'),
      },
    },
    async (request, reply) => {
      const query = request.query as Record<string, unknown>
      const period = TopListPeriodSchema.safeParse(query.period)
      const dimension = TopListDimensionSchema.safeParse(query.dimension)
      const sort = TopListSortSchema.safeParse(query.sort ?? 'desc')
      if (!period.success) return reply.status(400).send({ error: 'Invalid period' })
      if (!dimension.success) return reply.status(400).send({ error: 'Invalid dimension' })
      if (!sort.success) return reply.status(400).send({ error: 'Invalid sort' })

      const buckets = await buildTopListsByDimension(fastify.prisma, {
        since: periodSince(period.data),
        dimension: dimension.data,
        sort: sort.data,
      })

      return reply.send({
        period: period.data,
        dimension: dimension.data,
        sort: sort.data,
        buckets,
      })
    },
  )
}

export default adminTopListsRoutes
