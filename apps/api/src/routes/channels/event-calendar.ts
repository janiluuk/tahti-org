// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@tahti/db'
import {
  ArtistEventIdParamSchema,
  EventCalendarQuerySchema,
  openApiResponse,
  parseRouteParams,
  safeDisplayName,
  UpcomingEventListSchema,
  UpcomingEventSchema,
  UsernameParamSchema,
} from '@tahti/shared'
import {
  eventVisibilityWhere,
  participantInclude,
  PUBLIC_EVENT_STATUSES,
  serializeArtistEvent,
} from '../../lib/artist-event.js'
import { availableUserWhere } from '../../lib/listed-artist.js'
import { escapeIcsText, foldIcsLine } from '../venues/venues.js'

const FEED_DAYS = 90
const FEED_LIMIT = 200

const hostInclude = {
  ...participantInclude,
  user: {
    select: {
      username: true,
      displayName: true,
      avatarUrl: true,
      channel: { select: { slug: true } },
    },
  },
}

type CalendarRow = Prisma.ArtistEventGetPayload<{ include: typeof hostInclude }>

function toCalendarEvent(row: CalendarRow) {
  return {
    ...serializeArtistEvent(row),
    artistDisplayName: safeDisplayName(row.user.displayName, row.user.username),
    artistUsername: row.user.username,
    channelSlug: row.user.channel?.slug ?? null,
    avatarUrl: row.user.avatarUrl ?? null,
  }
}

function icsDate(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

export function buildEventsIcs(name: string, rows: CalendarRow[], now = new Date()): string {
  const webOrigin = (process.env.PUBLIC_WEB_URL ?? 'https://tahti.live').replace(/\/$/, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tahti ry//Events//EN',
    `X-WR-CALNAME:${escapeIcsText(name)}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  const stamp = icsDate(now)
  for (const row of rows) {
    const end = row.endAt ?? new Date(row.startAt.getTime() + 3 * 3600 * 1000)
    const artist = safeDisplayName(row.user.displayName, row.user.username)
    const url = row.ticketUrl ?? row.eventUrl ?? `${webOrigin}/u/${row.user.username}`
    lines.push(
      'BEGIN:VEVENT',
      `UID:${row.id}@tahti.live`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(row.startAt)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${escapeIcsText(`${row.title} — ${artist}`)}`,
      `LOCATION:${escapeIcsText(`${row.place}, ${row.location}`)}`,
      `URL:${url}`,
      `STATUS:${row.status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED'}`,
      ...(row.description ? [`DESCRIPTION:${escapeIcsText(row.description)}`] : []),
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldIcsLine).join('\r\n') + '\r\n'
}

const eventCalendarRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/events?from&to[&artist] — the public calendar under Feed
  fastify.get(
    '/api/v1/events',
    {
      schema: {
        tags: ['channel'],
        description:
          'Public events in a date range (published and cancelled), optionally for one artist including events they accepted a tag on.',
        response: openApiResponse(UpcomingEventListSchema, 'UpcomingEventList'),
      },
    },
    async (request, reply) => {
      const parsed = EventCalendarQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid query' })
      }
      const { from, to, artist } = parsed.data
      const artistWhere: Prisma.ArtistEventWhereInput = artist
        ? {
            OR: [
              { user: { username: { equals: artist, mode: 'insensitive' } } },
              {
                participants: {
                  some: {
                    status: 'ACCEPTED',
                    user: { username: { equals: artist, mode: 'insensitive' } },
                  },
                },
              },
            ],
          }
        : {}
      const rows = await fastify.prisma.artistEvent.findMany({
        where: {
          startAt: { gte: new Date(from), lt: new Date(to) },
          status: { in: [...PUBLIC_EVENT_STATUSES] },
          user: availableUserWhere,
          AND: [artistWhere, eventVisibilityWhere(request.sessionUser?.id)],
        },
        orderBy: { startAt: 'asc' },
        take: 500,
        include: hostInclude,
      })
      return reply.send(rows.map(toCalendarEvent))
    },
  )

  // GET /api/v1/events/:id — one public event (the web event page)
  fastify.get(
    '/api/v1/events/:id',
    {
      schema: {
        tags: ['channel'],
        description: 'One published or cancelled event with its host and accepted tags.',
        response: openApiResponse(UpcomingEventSchema, 'UpcomingEvent'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(ArtistEventIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const row = await fastify.prisma.artistEvent.findFirst({
        where: {
          id: routeParams.id,
          status: { in: [...PUBLIC_EVENT_STATUSES] },
          user: availableUserWhere,
          ...eventVisibilityWhere(request.sessionUser?.id),
        },
        include: hostInclude,
      })
      if (!row) return reply.status(404).send({ error: 'Event not found' })
      return reply.send(toCalendarEvent(row))
    },
  )

  // GET /api/v1/events.ics — every published event in the next 90 days
  fastify.get(
    '/api/v1/events.ics',
    { schema: { tags: ['channel'], description: 'iCalendar feed of upcoming Tahti events' } },
    async (_request, reply) => {
      const now = new Date()
      const rows = await fastify.prisma.artistEvent.findMany({
        where: {
          startAt: { gte: now, lt: new Date(now.getTime() + FEED_DAYS * 86_400_000) },
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          user: availableUserWhere,
        },
        orderBy: { startAt: 'asc' },
        take: FEED_LIMIT,
        include: hostInclude,
      })
      return reply
        .header('Content-Type', 'text/calendar; charset=utf-8')
        .header('Content-Disposition', 'inline; filename="tahti-events.ics"')
        .send(buildEventsIcs('Tahti events', rows, now))
    },
  )

  // GET /api/v1/u/:username/events.ics — one artist's events, incl. accepted tags
  fastify.get(
    '/api/v1/u/:username/events.ics',
    { schema: { tags: ['channel'], description: "iCalendar feed of an artist's events" } },
    async (request, reply) => {
      const routeParams = parseRouteParams(UsernameParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const owner = await fastify.prisma.user.findFirst({
        where: {
          username: { equals: routeParams.username, mode: 'insensitive' },
          ...availableUserWhere,
        },
        select: { id: true, username: true, displayName: true },
      })
      if (!owner) return reply.status(404).send({ error: 'Artist not found' })
      const now = new Date()
      const rows = await fastify.prisma.artistEvent.findMany({
        where: {
          OR: [
            { userId: owner.id },
            { participants: { some: { userId: owner.id, status: 'ACCEPTED' } } },
          ],
          startAt: { gte: new Date(now.getTime() - 30 * 86_400_000) },
          status: { in: [...PUBLIC_EVENT_STATUSES] },
          visibility: 'PUBLIC',
          user: availableUserWhere,
        },
        orderBy: { startAt: 'asc' },
        take: FEED_LIMIT,
        include: hostInclude,
      })
      const name = `${safeDisplayName(owner.displayName, owner.username)} — Tahti`
      return reply
        .header('Content-Type', 'text/calendar; charset=utf-8')
        .header('Content-Disposition', `inline; filename="${owner.username}-events.ics"`)
        .send(buildEventsIcs(name, rows, now))
    },
  )
}

export default eventCalendarRoutes
