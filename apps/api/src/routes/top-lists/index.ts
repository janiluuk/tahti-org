// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  TopListPeriodSchema,
  TopListRanksResponseSchema,
  TopListResponseSchema,
  TopListSortSchema,
  openApiResponse,
} from '@tahti/shared'
import { buildTopList, periodSince, rankLookup } from '../../lib/top-lists.js'

const VALID_CONTENT_TYPES = [
  'LIVE',
  'STUDIO',
  'DJ_MIX',
  'PODCAST',
  'ORIGINAL',
  'REMIX',
  'RADIO_SHOW',
]

const topListsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/top-lists?period=week|month&contentTypes=DJ_MIX,RADIO_SHOW&sort=asc&genre=Techno
  fastify.get(
    '/api/top-lists',
    { schema: { response: openApiResponse(TopListResponseSchema, 'TopList') } },
    async (request, reply) => {
      const query = request.query as Record<string, unknown>
      const period = TopListPeriodSchema.safeParse(query.period)
      if (!period.success) return reply.status(400).send({ error: 'Invalid period' })

      const sort = TopListSortSchema.safeParse(query.sort ?? 'desc')
      if (!sort.success) return reply.status(400).send({ error: 'Invalid sort' })

      let contentTypes: string[] | undefined
      if (typeof query.contentTypes === 'string' && query.contentTypes.length > 0) {
        contentTypes = query.contentTypes.split(',').filter((t) => VALID_CONTENT_TYPES.includes(t))
        if (contentTypes.length === 0) {
          return reply.status(400).send({ error: 'Invalid contentTypes' })
        }
      }

      const genre =
        typeof query.genre === 'string' && query.genre.length > 0 ? query.genre : undefined

      const entries = await buildTopList(fastify.prisma, {
        since: periodSince(period.data),
        contentTypes,
        genre,
        sort: sort.data,
        limit: 20,
      })

      return reply.send({ period: period.data, entries })
    },
  )

  // GET /api/top-lists/ranks?ids=a,b,c — best current rank per track, for the
  // public rank badge. Never errors on unknown/empty ids, just omits them.
  fastify.get(
    '/api/top-lists/ranks',
    { schema: { response: openApiResponse(TopListRanksResponseSchema, 'TopListRanks') } },
    async (request, reply) => {
      const raw = (request.query as Record<string, unknown>).ids
      const ids =
        typeof raw === 'string'
          ? raw
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 100)
          : []

      const best = await rankLookup(fastify.prisma, ids)
      return reply.send({ ranks: Object.fromEntries(best) })
    },
  )
}

export default topListsRoutes
