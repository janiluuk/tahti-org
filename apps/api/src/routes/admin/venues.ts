// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AdminVenueListSchema,
  SlugParamSchema,
  VenueRecordSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'

// M17: board verifies venue listings before they appear in the public directory.
const adminVenueRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/venues',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'M17: list all venues (board)',
        response: openApiResponse(AdminVenueListSchema, 'AdminVenueList'),
      },
    },
    async (_request, reply) => {
      const venues = await fastify.prisma.venue.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          slug: true,
          name: true,
          city: true,
          countryCode: true,
          verifiedAt: true,
          createdAt: true,
          createdBy: true,
        },
      })
      return reply.send(venues)
    },
  )

  fastify.post(
    '/api/admin/venues/:slug/verify',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'M17: verify a venue listing',
        response: openApiResponse(VenueRecordSchema, 'VenueRecord'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams
      const venue = await fastify.prisma.venue.findUnique({ where: { slug } })
      if (!venue) return reply.status(404).send({ error: 'Venue not found' })

      const updated = await fastify.prisma.venue.update({
        where: { slug },
        data: { verifiedAt: new Date() },
      })
      return reply.send(updated)
    },
  )

  fastify.post(
    '/api/admin/venues/:slug/unverify',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'M17: remove venue verification',
        response: openApiResponse(VenueRecordSchema, 'VenueRecord'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams
      const venue = await fastify.prisma.venue.findUnique({ where: { slug } })
      if (!venue) return reply.status(404).send({ error: 'Venue not found' })

      const updated = await fastify.prisma.venue.update({
        where: { slug },
        data: { verifiedAt: null },
      })
      return reply.send(updated)
    },
  )
}

export default adminVenueRoutes
