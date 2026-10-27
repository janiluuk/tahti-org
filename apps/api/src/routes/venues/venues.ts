// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  CreateVenueBroadcastSchema,
  CreateVenueSchema,
  PatchVenueSchema,
  PatchVenueBroadcastSchema,
  SlugParamSchema,
  VenueBroadcastCalendarSchema,
  VenueCalendarQuerySchema,
  VenueDirectoryListSchema,
  VenuePublicProfileSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { restrictionErrorMessage } from '@tahti/db'
import { requireAuth } from '../../plugins/auth.js'
import { trackArtistName } from '../../lib/safe-names.js'

const VENUE_RECORDINGS_LIMIT = 24

// Shows still to come, plus one on now: a LIVE show started in the past, so
// a plain `startAt >= now` filter dropped it while it was playing.
function upcomingOrLive(now: Date) {
  return {
    OR: [{ state: 'SCHEDULED' as const, startAt: { gte: now } }, { state: 'LIVE' as const }],
  }
}

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

// M17 — Venue directory and broadcast calendar
const venueRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/venues — public directory (verified only)
  fastify.get(
    '/api/v1/venues',
    {
      schema: {
        tags: ['venues'],
        description: 'M17: verified venue directory',
        response: openApiResponse(VenueDirectoryListSchema, 'VenueDirectoryList'),
      },
    },
    async (_request, reply) => {
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
          photos: true,
        },
        orderBy: { name: 'asc' },
      })
      return reply.send(venues)
    },
  )

  // GET /api/v1/venues/:slug — public venue profile
  fastify.get(
    '/api/v1/venues/:slug',
    {
      schema: {
        tags: ['venues'],
        description: 'M17: public venue profile',
        response: openApiResponse(VenuePublicProfileSchema, 'VenuePublicProfile'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams

      const venue = await fastify.prisma.venue.findUnique({
        where: { slug },
        include: {
          broadcasts: {
            where: upcomingOrLive(new Date()),
            orderBy: { startAt: 'asc' },
            take: 20,
          },
        },
      })

      if (!venue) return reply.status(404).send({ error: 'Venue not found' })
      if (!venue.verifiedAt) return reply.status(404).send({ error: 'Venue not found' })

      const sounds = await fastify.prisma.sound.findMany({
        where: {
          venueId: venue.id,
          isPublic: true,
          status: 'READY',
          channel: { user: { deletedAt: null, suspendedAt: null } },
        },
        orderBy: { releasedAt: 'desc' },
        take: VENUE_RECORDINGS_LIMIT,
        select: {
          id: true,
          title: true,
          artistName: true,
          durationSec: true,
          bannerUrl: true,
          releasedAt: true,
          channel: {
            select: { slug: true, user: { select: { username: true, displayName: true } } },
          },
        },
      })

      return reply.send({
        ...venue,
        recordings: sounds.map((s) => ({
          id: s.id,
          title: s.title,
          artistName: trackArtistName(s),
          channelSlug: s.channel.slug,
          durationSec: s.durationSec,
          coverUrl: s.bannerUrl,
          releasedAt: s.releasedAt.toISOString(),
        })),
      })
    },
  )

  // GET /api/v1/venues/:slug/broadcasts — JSON calendar feed
  fastify.get(
    '/api/v1/venues/:slug/broadcasts',
    {
      schema: {
        tags: ['venues'],
        description: 'M17: venue broadcast calendar (JSON)',
        response: openApiResponse(VenueBroadcastCalendarSchema, 'VenueBroadcastCalendar'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams
      const parsedQuery = VenueCalendarQuerySchema.safeParse(request.query)
      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: parsedQuery.error.issues[0]?.message ?? 'Invalid query',
        })
      }

      const venue = await fastify.prisma.venue.findUnique({
        where: { slug, verifiedAt: { not: null } },
        select: { id: true, name: true },
      })
      if (!venue) return reply.status(404).send({ error: 'Venue not found' })

      const fromDate = parsedQuery.data.from ? new Date(parsedQuery.data.from) : new Date()
      const toDate = parsedQuery.data.to
        ? new Date(parsedQuery.data.to)
        : new Date(Date.now() + 90 * 24 * 3600 * 1000)

      const broadcasts = await fastify.prisma.venueBroadcast.findMany({
        where: {
          venueId: venue.id,
          startAt: { gte: fromDate, lte: toDate },
        },
        orderBy: { startAt: 'asc' },
      })

      return reply.send({ venue: { id: venue.id, name: venue.name, slug }, broadcasts })
    },
  )

  // GET /api/v1/venues/:slug/calendar.ics — iCalendar feed
  fastify.get(
    '/api/v1/venues/:slug/calendar.ics',
    { schema: { tags: ['venues'], description: 'M17: venue iCalendar feed' } },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams

      const venue = await fastify.prisma.venue.findUnique({
        where: { slug, verifiedAt: { not: null } },
      })
      if (!venue) return reply.status(404).send({ error: 'Venue not found' })

      const broadcasts = await fastify.prisma.venueBroadcast.findMany({
        where: { venueId: venue.id, ...upcomingOrLive(new Date()) },
        orderBy: { startAt: 'asc' },
        take: 100,
      })

      const ics = buildIcs(venue, broadcasts)
      return reply
        .header('Content-Type', 'text/calendar; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${slug}.ics"`)
        .send(ics)
    },
  )

  // GET /api/me/venues — list venues owned by the authenticated user
  fastify.get('/api/me/venues', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const venues = await fastify.prisma.venue.findMany({
      where: { createdBy: user.id },
      include: {
        broadcasts: {
          where: upcomingOrLive(new Date()),
          orderBy: { startAt: 'asc' },
          take: 10,
        },
      },
      orderBy: { name: 'asc' },
    })
    return reply.send(venues)
  })

  // POST /api/v1/venues — create venue (auth required, unverified until board approves)
  fastify.post('/api/v1/venues', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const parsed = CreateVenueSchema.safeParse(request.body)
    if (!parsed.success) return zodError(reply, parsed.error)
    const body = parsed.data

    const existing = await fastify.prisma.venue.findUnique({ where: { slug: body.slug } })
    if (existing) return reply.status(409).send({ error: 'Slug already taken' })

    const venue = await fastify.prisma.venue.create({
      data: {
        slug: body.slug,
        name: body.name,
        address: body.address,
        city: body.city,
        countryCode: body.countryCode ?? 'FI',
        description: body.description?.trim() || null,
        capacity: body.capacity ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        photos: body.photos ?? [],
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
      const bookingBanError = await restrictionErrorMessage(
        fastify.prisma,
        user.id,
        'LIVE_SHOW_BOOKING',
      )
      if (bookingBanError) return reply.status(403).send({ error: bookingBanError })
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug } = routeParams
      const parsed = CreateVenueBroadcastSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const body = parsed.data

      const venue = await fastify.prisma.venue.findUnique({ where: { slug } })
      if (!venue) return reply.status(404).send({ error: 'Venue not found' })

      const startAt = new Date(body.startAt)
      const endAt = body.endAt ? new Date(body.endAt) : null
      if (endAt && endAt <= startAt) {
        return reply.status(400).send({ error: 'The show must end after it starts' })
      }

      // Same check as PATCH (SEC-014): a show may only be credited to the
      // caller's own channel.
      if (body.channelId) {
        const ownChannel = await fastify.prisma.channel.findFirst({
          where: { id: body.channelId, userId: user.id },
          select: { id: true },
        })
        if (!ownChannel) return reply.status(403).send({ error: 'You do not own that channel' })
      }

      const broadcast = await fastify.prisma.venueBroadcast.create({
        data: {
          venueId: venue.id,
          artistUserId: user.id,
          startAt,
          endAt,
          description: body.description?.trim() || null,
          channelId: body.channelId ?? null,
          state: 'SCHEDULED',
        },
      })

      return reply.status(201).send(broadcast)
    },
  )

  // PATCH /api/v1/venues/:slug — update venue profile (owner only)
  fastify.patch('/api/v1/venues/:slug', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const routeParams = parseRouteParams(SlugParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const parsed = PatchVenueSchema.safeParse(request.body)
    if (!parsed.success) return zodError(reply, parsed.error)
    const body = parsed.data

    const venue = await fastify.prisma.venue.findUnique({
      where: { slug: routeParams.slug },
    })
    if (!venue) return reply.status(404).send({ error: 'Venue not found' })
    if (venue.createdBy !== user.id) return reply.status(403).send({ error: 'Forbidden' })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Record<string, any> = {}
    if (body.name !== undefined) data.name = body.name
    if (body.address !== undefined) data.address = body.address
    if (body.city !== undefined) data.city = body.city
    if (body.countryCode !== undefined) data.countryCode = body.countryCode
    if (body.description !== undefined) data.description = body.description
    if (body.capacity !== undefined) data.capacity = body.capacity
    if (body.latitude !== undefined) data.latitude = body.latitude
    if (body.longitude !== undefined) data.longitude = body.longitude
    if (body.externalLinks !== undefined) data.externalLinks = body.externalLinks
    if (body.photos !== undefined) data.photos = body.photos

    const updated = await fastify.prisma.venue.update({
      where: { slug: routeParams.slug },
      data,
    })
    return reply.send(updated)
  })

  // PATCH /api/v1/venues/:slug/broadcasts/:broadcastId — update broadcast
  fastify.patch(
    '/api/v1/venues/:slug/broadcasts/:broadcastId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const params = request.params as { slug: string; broadcastId: string }
      const parsed = PatchVenueBroadcastSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const body = parsed.data

      const broadcast = await fastify.prisma.venueBroadcast.findFirst({
        where: { id: params.broadcastId, venue: { slug: params.slug } },
      })
      if (!broadcast) return reply.status(404).send({ error: 'Broadcast not found' })
      if (broadcast.artistUserId !== user.id) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      // SEC-014: channelId is caller-supplied — without this check, an
      // artist could label their venue broadcast with any other artist's
      // channel id, misattributing "hosted by channel X" to someone who
      // never opted in.
      if (body.channelId !== undefined && body.channelId !== null) {
        const targetChannel = await fastify.prisma.channel.findFirst({
          where: { id: body.channelId, userId: user.id },
          select: { id: true },
        })
        if (!targetChannel) {
          return reply.status(403).send({ error: 'You do not own that channel' })
        }
      }

      const nextStart = body.startAt !== undefined ? new Date(body.startAt) : broadcast.startAt
      const nextEnd =
        body.endAt !== undefined ? (body.endAt ? new Date(body.endAt) : null) : broadcast.endAt
      if (nextEnd && nextEnd <= nextStart) {
        return reply.status(400).send({ error: 'The show must end after it starts' })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: Record<string, any> = {}
      if (body.startAt !== undefined) data.startAt = new Date(body.startAt)
      if (body.endAt !== undefined) data.endAt = body.endAt ? new Date(body.endAt) : null
      if (body.description !== undefined) data.description = body.description
      if (body.channelId !== undefined) data.channelId = body.channelId
      if (body.state !== undefined) data.state = body.state

      const updated = await fastify.prisma.venueBroadcast.update({
        where: { id: broadcast.id },
        data,
      })
      return reply.send(updated)
    },
  )

  // DELETE /api/v1/venues/:slug/broadcasts/:broadcastId — cancel / delete broadcast
  fastify.delete(
    '/api/v1/venues/:slug/broadcasts/:broadcastId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const params = request.params as { slug: string; broadcastId: string }

      const broadcast = await fastify.prisma.venueBroadcast.findFirst({
        where: { id: params.broadcastId, venue: { slug: params.slug } },
        include: { venue: { select: { createdBy: true } } },
      })
      if (!broadcast) return reply.status(404).send({ error: 'Broadcast not found' })
      // The artist who booked the show, or the venue that hosts it, may call it off.
      if (broadcast.artistUserId !== user.id && broadcast.venue.createdBy !== user.id) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      await fastify.prisma.venueBroadcast.update({
        where: { id: broadcast.id },
        data: { state: 'CANCELED' },
      })
      return reply.status(204).send()
    },
  )
}

/** RFC 5545 TEXT: backslash, semicolon, comma and newlines are escaped. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** RFC 5545 folds content lines longer than 75 octets, continuing with a space. */
export function foldIcsLine(line: string): string {
  const bytes = Buffer.from(line, 'utf8')
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let start = 0
  let limit = 75
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length)
    // Never split a multi-byte character.
    while (end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end--
    parts.push(bytes.subarray(start, end).toString('utf8'))
    start = end
    limit = 74
  }
  return parts.join('\r\n ')
}

// Minimal iCalendar builder
export function buildIcs(
  venue: { name: string; slug: string; address: string; city: string },
  broadcasts: Array<{
    id: string
    startAt: Date
    endAt: Date | null
    description: string | null
    state: string
  }>,
  now = new Date(),
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tahti ry//Venue Calendar//EN',
    `X-WR-CALNAME:${escapeIcsText(`${venue.name} — Tahti`)}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  const dtstamp = formatIcsDate(now)
  for (const b of broadcasts) {
    const dtstart = formatIcsDate(b.startAt)
    const dtend = b.endAt
      ? formatIcsDate(b.endAt)
      : formatIcsDate(new Date(b.startAt.getTime() + 2 * 3600 * 1000))
    lines.push(
      'BEGIN:VEVENT',
      `UID:${b.id}@tahti.live`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${dtstart}`,
      `DTEND:${dtend}`,
      `SUMMARY:${escapeIcsText(`Live at ${venue.name}`)}`,
      `LOCATION:${escapeIcsText(`${venue.address}, ${venue.city}`)}`,
      ...(b.description ? [`DESCRIPTION:${escapeIcsText(b.description)}`] : []),
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return lines.map(foldIcsLine).join('\r\n') + '\r\n'
}

function formatIcsDate(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

export default venueRoutes
