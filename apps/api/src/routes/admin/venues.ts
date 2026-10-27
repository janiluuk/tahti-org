// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AdminVenueListSchema,
  AdminVenueUpdatedSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
  safeDisplayName,
} from '@tahti/shared'
import { notifyVenueOwnerOfVerification } from '@tahti/db'
import { requireBoard } from '../../plugins/auth.js'

// M17: board verifies venue listings before they appear in the public directory.
const adminVenueRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/venues',
    {
      preHandler: requireBoard,
      schema: { response: openApiResponse(AdminVenueListSchema, 'AdminVenueList') },
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
      const submitters = await fastify.prisma.user.findMany({
        where: { id: { in: [...new Set(venues.map((venue) => venue.createdBy))] } },
        select: { id: true, username: true, displayName: true },
      })
      const byId = new Map(submitters.map((user) => [user.id, user]))
      return reply.send(
        venues.map((venue) => {
          const submitter = byId.get(venue.createdBy)
          return {
            ...venue,
            submitter: submitter
              ? {
                  username: submitter.username,
                  displayName: safeDisplayName(submitter.displayName, submitter.username),
                }
              : null,
          }
        }),
      )
    },
  )

  fastify.post(
    '/api/admin/venues/:slug/verify',
    {
      preHandler: requireBoard,
      schema: { response: openApiResponse(AdminVenueUpdatedSchema, 'AdminVenueUpdated') },
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
      if (!venue.verifiedAt) {
        await notifyVenueOwnerOfVerification(fastify.prisma, venue, true).catch((err: unknown) =>
          fastify.log.warn({ err }, 'venue verification notice failed'),
        )
      }
      return reply.send(updated)
    },
  )

  fastify.post(
    '/api/admin/venues/:slug/unverify',
    {
      preHandler: requireBoard,
      schema: { response: openApiResponse(AdminVenueUpdatedSchema, 'AdminVenueUpdated') },
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
      if (venue.verifiedAt) {
        await notifyVenueOwnerOfVerification(fastify.prisma, venue, false).catch((err: unknown) =>
          fastify.log.warn({ err }, 'venue verification notice failed'),
        )
      }
      return reply.send(updated)
    },
  )
}

export default adminVenueRoutes
