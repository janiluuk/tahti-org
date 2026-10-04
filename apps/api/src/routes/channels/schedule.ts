// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  PublicChannelScheduleSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
  seriesShowDurationMin,
  type PublicChannelSchedule,
} from '@tahti/shared'

const HORIZON_DAYS = 60
const MAX_SHOWS = 50

const channelScheduleRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/channels/:slug/schedule',
    {
      schema: {
        tags: ['channel'],
        description: `Public upcoming live shows for a channel (next ${HORIZON_DAYS} days)`,
        response: openApiResponse(PublicChannelScheduleSchema, 'PublicChannelSchedule'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug: routeParams.slug },
        select: { id: true, user: { select: { deletedAt: true, suspendedAt: true } } },
      })
      if (!channel || channel.user.deletedAt || channel.user.suspendedAt) {
        return reply.status(404).send({ error: 'Channel not found' })
      }

      const now = new Date()
      const horizon = new Date(now.getTime() + HORIZON_DAYS * 86_400_000)
      const rows = await fastify.prisma.scheduledLiveShow.findMany({
        where: {
          channelId: channel.id,
          canceledAt: null,
          // A show copies its series' visibility when booked, but the series
          // can be switched to fan-only later, so both must still be public.
          visibility: 'PUBLIC',
          series: { visibility: 'PUBLIC' },
          startAt: { gte: now, lte: horizon },
        },
        orderBy: { startAt: 'asc' },
        take: MAX_SHOWS,
        select: {
          id: true,
          seriesId: true,
          startAt: true,
          endAt: true,
          title: true,
          episodeNumber: true,
          showType: true,
          series: {
            select: {
              id: true,
              name: true,
              scheduleNote: true,
              recurrenceDurationMin: true,
              intervalHours: true,
            },
          },
        },
      })

      const series = new Map<string, PublicChannelSchedule['series'][number]>()
      const shows = rows.map((row) => {
        series.set(row.series.id, {
          id: row.series.id,
          name: row.series.name,
          scheduleNote: row.series.scheduleNote,
        })
        const durationMin = row.endAt
          ? Math.round((row.endAt.getTime() - row.startAt.getTime()) / 60_000)
          : seriesShowDurationMin(row.series)
        return {
          id: row.id,
          seriesId: row.seriesId,
          startAt: row.startAt.toISOString(),
          endAt: row.endAt?.toISOString() ?? null,
          durationMin: durationMin && durationMin > 0 ? durationMin : null,
          title: row.title,
          episodeNumber: row.episodeNumber,
          showType: row.showType,
        }
      })

      const body: PublicChannelSchedule = { shows, series: [...series.values()] }
      return reply.send(body)
    },
  )
}

export default channelScheduleRoute
