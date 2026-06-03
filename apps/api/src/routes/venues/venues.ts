// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'

// M17 — Venue directory and broadcast calendar
const venueRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/venues — public directory (verified only)
  fastify.get('/api/v1/venues', async (_request, reply) => {
    const venues = await fastify.prisma.venue.findMany({
      where: { verifiedAt: { not: null } },
      select: {
        id: true,
        slug: true,
        name: true,
        city: true,
        countryCode: true,
        capacity: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    })
    return reply.send(venues)
  })

  // GET /api/v1/venues/:slug — public venue profile
  fastify.get('/api/v1/venues/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }

    const venue = await fastify.prisma.venue.findUnique({
      where: { slug },
      include: {
        broadcasts: {
          where: { startAt: { gte: new Date() }, state: 'SCHEDULED' },
          orderBy: { startAt: 'asc' },
          take: 20,
        },
      },
    })

    if (!venue) return reply.status(404).send({ error: 'Venue not found' })
    if (!venue.verifiedAt) return reply.status(404).send({ error: 'Venue not found' })

    return reply.send(venue)
  })

  // GET /api/v1/venues/:slug/broadcasts — JSON calendar feed
  fastify.get('/api/v1/venues/:slug/broadcasts', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const { from, to } = request.query as { from?: string; to?: string }

    const venue = await fastify.prisma.venue.findUnique({
      where: { slug, verifiedAt: { not: null } },
      select: { id: true, name: true },
    })
    if (!venue) return reply.status(404).send({ error: 'Venue not found' })

    const fromDate = from ? new Date(from) : new Date()
    const toDate = to ? new Date(to) : new Date(Date.now() + 90 * 24 * 3600 * 1000)

    const broadcasts = await fastify.prisma.venueBroadcast.findMany({
      where: {
        venueId: venue.id,
        startAt: { gte: fromDate, lte: toDate },
      },
      orderBy: { startAt: 'asc' },
    })

    return reply.send({ venue: { id: venue.id, name: venue.name, slug }, broadcasts })
  })

  // GET /api/v1/venues/:slug/calendar.ics — iCalendar feed
  fastify.get('/api/v1/venues/:slug/calendar.ics', async (request, reply) => {
    const { slug } = request.params as { slug: string }

    const venue = await fastify.prisma.venue.findUnique({
      where: { slug, verifiedAt: { not: null } },
    })
    if (!venue) return reply.status(404).send({ error: 'Venue not found' })

    const broadcasts = await fastify.prisma.venueBroadcast.findMany({
      where: {
        venueId: venue.id,
        startAt: { gte: new Date() },
        state: { in: ['SCHEDULED', 'LIVE'] },
      },
      orderBy: { startAt: 'asc' },
      take: 100,
    })

    const ics = buildIcs(venue, broadcasts)
    return reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${slug}.ics"`)
      .send(ics)
  })

  // POST /api/v1/venues — create venue (auth required, unverified until board approves)
  fastify.post('/api/v1/venues', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const body = request.body as {
      slug?: string
      name?: string
      address?: string
      city?: string
      countryCode?: string
      description?: string
      capacity?: number
      latitude?: number
      longitude?: number
      externalLinks?: unknown
    }

    const slug = body.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
    if (!slug) return reply.status(400).send({ error: 'slug is required' })
    const name = body.name?.trim()
    if (!name) return reply.status(400).send({ error: 'name is required' })
    const address = body.address?.trim()
    if (!address) return reply.status(400).send({ error: 'address is required' })
    const city = body.city?.trim()
    if (!city) return reply.status(400).send({ error: 'city is required' })

    const existing = await fastify.prisma.venue.findUnique({ where: { slug } })
    if (existing) return reply.status(409).send({ error: 'Slug already taken' })

    const venue = await fastify.prisma.venue.create({
      data: {
        slug,
        name,
        address,
        city,
        countryCode: body.countryCode ?? 'FI',
        description: body.description?.trim() || null,
        capacity: body.capacity ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        externalLinks: (body.externalLinks ?? null) as any,
        createdBy: user.id,
      },
    })

    return reply.status(201).send(venue)
  })

  // POST /api/v1/venues/:slug/broadcasts — add a broadcast event
  fastify.post(
    '/api/v1/venues/:slug/broadcasts',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const { slug } = request.params as { slug: string }
      const body = request.body as {
        startAt?: string
        endAt?: string
        description?: string
        channelId?: string
      }

      const venue = await fastify.prisma.venue.findUnique({ where: { slug } })
      if (!venue) return reply.status(404).send({ error: 'Venue not found' })

      if (!body.startAt) return reply.status(400).send({ error: 'startAt is required' })
      const startAt = new Date(body.startAt)
      if (Number.isNaN(startAt.getTime())) {
        return reply.status(400).send({ error: 'Invalid startAt' })
      }

      const broadcast = await fastify.prisma.venueBroadcast.create({
        data: {
          venueId: venue.id,
          artistUserId: user.id,
          startAt,
          endAt: body.endAt ? new Date(body.endAt) : null,
          description: body.description?.trim() || null,
          channelId: body.channelId ?? null,
          state: 'SCHEDULED',
        },
      })

      return reply.status(201).send(broadcast)
    },
  )
}

// Minimal iCalendar builder
function buildIcs(
  venue: { name: string; slug: string; address: string; city: string },
  broadcasts: Array<{
    id: string
    startAt: Date
    endAt: Date | null
    description: string | null
    state: string
  }>,
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tahti ry//Venue Calendar//EN',
    `X-WR-CALNAME:${venue.name} — Tahti`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  for (const b of broadcasts) {
    const dtstart = formatIcsDate(b.startAt)
    const dtend = b.endAt ? formatIcsDate(b.endAt) : formatIcsDate(new Date(b.startAt.getTime() + 2 * 3600 * 1000))
    lines.push(
      'BEGIN:VEVENT',
      `UID:${b.id}@tahti.live`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:Live at ${venue.name}`,
      `LOCATION:${venue.address}\\, ${venue.city}`,
      ...(b.description ? [`DESCRIPTION:${b.description.replace(/\n/g, '\\n')}`] : []),
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

function formatIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export default venueRoutes
