// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ChannelSchedulePatchSchema,
  ChannelScheduleViewSchema,
  CreateLiveShowSeriesSchema,
  LiveShowSeriesListSchema,
  ScheduleLiveShowSchema,
  liveShowEpisodeTitle,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

type LiveShowSeriesDbRow = {
  id: string
  channelId: string
  name: string
  description: string | null
  tagline: string | null
  artworkUrl: string | null
  showType: 'LIVE_SET' | 'TALK'
  visibility: 'PUBLIC' | 'FAN_ONLY'
  autoArchive: boolean
  episodeNumberEnabled: boolean
  nextEpisodeNumber: number
  createdAt: Date
  updatedAt: Date
}

type ScheduledLiveShowDbRow = {
  id: string
  channelId: string
  seriesId: string
  startAt: Date
  episodeNumber: number | null
  title: string
  description: string | null
  tagline: string | null
  venue: string | null
  location: string | null
  artworkUrl: string | null
  showType: 'LIVE_SET' | 'TALK'
  visibility: 'PUBLIC' | 'FAN_ONLY'
  autoArchive: boolean
  canceledAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type ShowScheduleDelegates = {
  liveShowSeries: {
    findMany(args: object): Promise<LiveShowSeriesDbRow[]>
    findFirst(args: object): Promise<LiveShowSeriesDbRow | null>
    create(args: object): Promise<LiveShowSeriesDbRow>
    update(args: object): Promise<LiveShowSeriesDbRow>
  }
  scheduledLiveShow: {
    findMany(args: object): Promise<ScheduledLiveShowDbRow[]>
    findFirst(args: object): Promise<ScheduledLiveShowDbRow | null>
    create(args: object): Promise<ScheduledLiveShowDbRow>
    updateMany(args: object): Promise<{ count: number }>
  }
}

function showScheduleDb(client: unknown): ShowScheduleDelegates {
  return client as ShowScheduleDelegates
}

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

/** LISTENER-002 — artist sets when they plan to go live next. */
const channelScheduleRoutes: FastifyPluginAsync = async (fastify) => {
  const showDb = showScheduleDb(fastify.prisma)
  async function findChannel(userId: string) {
    return fastify.prisma.channel.findUnique({
      where: { userId },
      select: { id: true, nextBroadcastAt: true },
    })
  }

  async function syncNextBroadcast(channelId: string) {
    const next = await showDb.scheduledLiveShow.findFirst({
      where: {
        channelId,
        canceledAt: null,
        broadcast: null,
        startAt: { gt: new Date() },
      },
      orderBy: { startAt: 'asc' },
      select: { startAt: true, title: true },
    })
    await fastify.prisma.channel.update({
      where: { id: channelId },
      data: {
        nextBroadcastAt: next?.startAt ?? null,
        nextBroadcastNote: next?.title ?? null,
      },
    })
  }

  fastify.get(
    '/api/me/channel/schedule',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'LISTENER-002: next planned broadcast',
        response: openApiResponse(ChannelScheduleViewSchema, 'ChannelSchedule'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { nextBroadcastAt: true, nextBroadcastNote: true },
      })
      if (!channel) return reply.status(404).send({ error: 'No channel' })
      return reply.send({
        nextBroadcastAt: channel.nextBroadcastAt?.toISOString() ?? null,
        nextBroadcastNote: channel.nextBroadcastNote,
      })
    },
  )

  fastify.patch('/api/me/channel/schedule', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const parsed = ChannelSchedulePatchSchema.safeParse(request.body)
    if (!parsed.success) return zodError(reply, parsed.error)

    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!channel) return reply.status(404).send({ error: 'No channel' })

    const data: { nextBroadcastAt?: Date | null; nextBroadcastNote?: string | null } = {}
    if (parsed.data.nextBroadcastAt !== undefined) {
      data.nextBroadcastAt = parsed.data.nextBroadcastAt
        ? new Date(parsed.data.nextBroadcastAt)
        : null
    }
    if (parsed.data.nextBroadcastNote !== undefined) {
      data.nextBroadcastNote = parsed.data.nextBroadcastNote?.trim() || null
    }
    if (Object.keys(data).length === 0) {
      return reply.status(400).send({ error: 'No schedule fields to update' })
    }

    const updated = await fastify.prisma.channel.update({
      where: { id: channel.id },
      data,
      select: { nextBroadcastAt: true, nextBroadcastNote: true },
    })
    return reply.send({
      nextBroadcastAt: updated.nextBroadcastAt?.toISOString() ?? null,
      nextBroadcastNote: updated.nextBroadcastNote,
    })
  })

  fastify.get(
    '/api/me/channel/show-series',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(LiveShowSeriesListSchema, 'LiveShowSeriesList'),
      },
    },
    async (request, reply) => {
      const channel = await findChannel(request.sessionUser!.id)
      if (!channel) return reply.status(404).send({ error: 'No channel' })

      const [series, scheduledShows] = await Promise.all([
        showDb.liveShowSeries.findMany({
          where: { channelId: channel.id },
          orderBy: { createdAt: 'desc' },
        }),
        showDb.scheduledLiveShow.findMany({
          where: {
            channelId: channel.id,
            canceledAt: null,
            broadcast: null,
            startAt: { gt: new Date() },
          },
          orderBy: { startAt: 'asc' },
        }),
      ])

      return reply.send({
        series: series.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
          updatedAt: undefined,
          channelId: undefined,
        })),
        scheduledShows: scheduledShows.map((show) => ({
          ...show,
          startAt: show.startAt.toISOString(),
          createdAt: undefined,
          updatedAt: undefined,
          channelId: undefined,
          canceledAt: undefined,
        })),
      })
    },
  )

  fastify.post(
    '/api/me/channel/show-series',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = CreateLiveShowSeriesSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const channel = await findChannel(request.sessionUser!.id)
      if (!channel) return reply.status(404).send({ error: 'No channel' })

      const series = await showDb.liveShowSeries.create({
        data: {
          channelId: channel.id,
          ...parsed.data,
          description: parsed.data.description || null,
          tagline: parsed.data.tagline || null,
        },
      })
      return reply.status(201).send({
        ...series,
        createdAt: series.createdAt.toISOString(),
        updatedAt: undefined,
        channelId: undefined,
      })
    },
  )

  fastify.post(
    '/api/me/channel/show-series/:seriesId/episodes',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = ScheduleLiveShowSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const startAt = new Date(parsed.data.startAt)
      if (startAt <= new Date()) {
        return reply.status(400).send({ error: 'Show time must be in the future' })
      }

      const channel = await findChannel(request.sessionUser!.id)
      if (!channel) return reply.status(404).send({ error: 'No channel' })
      const { seriesId } = request.params as { seriesId: string }

      const scheduled = await fastify.prisma.$transaction(async (tx) => {
        const transactionDb = showScheduleDb(tx)
        const series = await transactionDb.liveShowSeries.findFirst({
          where: { id: seriesId, channelId: channel.id },
        })
        if (!series) return null

        const episodeNumber = series.episodeNumberEnabled ? series.nextEpisodeNumber : null
        const show = await transactionDb.scheduledLiveShow.create({
          data: {
            channelId: channel.id,
            seriesId: series.id,
            startAt,
            episodeNumber,
            title: liveShowEpisodeTitle(series.name, episodeNumber),
            description: series.description,
            tagline: series.tagline,
            venue: parsed.data.venue || null,
            location: parsed.data.location || null,
            artworkUrl: parsed.data.artworkUrl ?? series.artworkUrl,
            showType: series.showType,
            visibility: series.visibility,
            autoArchive: series.autoArchive,
          },
        })
        if (series.episodeNumberEnabled) {
          await transactionDb.liveShowSeries.update({
            where: { id: series.id },
            data: { nextEpisodeNumber: { increment: 1 } },
          })
        }
        return show
      })

      if (!scheduled) return reply.status(404).send({ error: 'Series not found' })
      await syncNextBroadcast(channel.id)
      return reply.status(201).send({
        ...scheduled,
        startAt: scheduled.startAt.toISOString(),
        createdAt: undefined,
        updatedAt: undefined,
        channelId: undefined,
        canceledAt: undefined,
      })
    },
  )

  fastify.delete(
    '/api/me/channel/scheduled-shows/:showId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const channel = await findChannel(request.sessionUser!.id)
      if (!channel) return reply.status(404).send({ error: 'No channel' })
      const { showId } = request.params as { showId: string }
      const updated = await showDb.scheduledLiveShow.updateMany({
        where: { id: showId, channelId: channel.id, broadcast: null, canceledAt: null },
        data: { canceledAt: new Date() },
      })
      if (updated.count === 0) return reply.status(404).send({ error: 'Scheduled show not found' })
      await syncNextBroadcast(channel.id)
      return reply.status(204).send()
    },
  )
}

export default channelScheduleRoutes
