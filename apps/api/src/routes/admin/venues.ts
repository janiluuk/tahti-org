// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireBoard } from '../../plugins/auth.js'

// M17: board verifies venue listings before they appear in the public directory.
const adminVenueRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/admin/venues', { preHandler: requireBoard }, async (_request, reply) => {
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
  })

  fastify.post(
    '/api/admin/venues/:slug/verify',
    { preHandler: requireBoard },
    async (request, reply) => {
      const { slug } = request.params as { slug: string }
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
    { preHandler: requireBoard },
    async (request, reply) => {
      const { slug } = request.params as { slug: string }
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
