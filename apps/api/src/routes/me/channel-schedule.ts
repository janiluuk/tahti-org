// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ChannelSchedulePatchSchema,
  ChannelScheduleViewSchema,
  CreateLiveShowEpisodeSchema,
  CreateLiveShowSeriesSchema,
  IdParamSchema,
  LiveShowEpisodeListSchema,
  LiveShowEpisodeViewSchema,
  LiveShowSeriesListSchema,
  PatchLiveShowEpisodeSchema,
  PatchLiveShowSeriesSchema,
  ScheduleLiveShowSchema,
  isValidRecurrenceRule,
  liveShowEpisodeTitle,
  nextRecurrenceOccurrences,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import {
  generateForSeries,
  restrictionErrorMessage,
  syncNextBroadcast as syncNextBroadcastDb,
} from '@tahti/db'
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
  autoPublish: boolean
  episodeNumberEnabled: boolean
  nextEpisodeNumber: number
  intervalHours: number
  scheduleNote: string | null
  recurrenceEnabled: boolean
  recurrenceDays: number[]
  recurrenceTimeOfDay: string | null
  recurrenceDurationMin: number | null
  recurrenceTimezone: string | null
  recurrenceHorizonDays: number
  createdAt: Date
  updatedAt: Date
}

type LiveShowEpisodeDbRow = {
  id: string
  channelId: string
  seriesId: string
  episodeNumber: number | null
  title: string
  description: string | null
  artworkUrl: string | null
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SCHEDULED' | 'LIVE'
  source: 'UPLOAD' | 'BROADCAST'
  soundId: string | null
  radioSlotBookingId: string | null
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
  autoPublish: boolean
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
  liveShowEpisode: {
    findMany(args: object): Promise<LiveShowEpisodeDbRow[]>
    findFirst(args: object): Promise<LiveShowEpisodeDbRow | null>
    create(args: object): Promise<LiveShowEpisodeDbRow>
    update(args: object): Promise<LiveShowEpisodeDbRow>
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
    await syncNextBroadcastDb(fastify.prisma, channelId)
  }

  /** Runs an immediate generation pass for one series right after it's
   * created/updated with recurrence on, so the artist sees upcoming shows
   * appear without waiting for the next day's cron tick (which still runs,
   * rolling the horizon forward as time passes — see
   * apps/worker/src/jobs/live-show-recurrence.ts). */
  async function generateRecurringEpisodes(series: LiveShowSeriesDbRow, userId: string) {
    const rule = {
      days: series.recurrenceDays,
      timeOfDay: series.recurrenceTimeOfDay,
      timezone: series.recurrenceTimezone,
    }
    if (!series.recurrenceEnabled || !isValidRecurrenceRule(rule)) return
    const occurrences = nextRecurrenceOccurrences(rule, new Date(), series.recurrenceHorizonDays)
    const created = await generateForSeries(fastify.prisma, { ...series, userId }, occurrences)
    if (created > 0) await syncNextBroadcast(series.channelId)
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

      if (parsed.data.recurrenceEnabled) {
        const banError = await restrictionErrorMessage(
          fastify.prisma,
          request.sessionUser!.id,
          'LIVE_SHOW_BOOKING',
        )
        if (banError) return reply.status(403).send({ error: banError })
      }

      const series = await showDb.liveShowSeries.create({
        data: {
          channelId: channel.id,
          ...parsed.data,
          description: parsed.data.description || null,
          tagline: parsed.data.tagline || null,
          scheduleNote: parsed.data.scheduleNote || null,
        },
      })
      await generateRecurringEpisodes(series, request.sessionUser!.id)
      return reply.status(201).send({
        ...series,
        createdAt: series.createdAt.toISOString(),
        updatedAt: undefined,
        channelId: undefined,
      })
    },
  )

  fastify.patch(
    '/api/me/channel/show-series/:seriesId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = PatchLiveShowSeriesSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const channel = await findChannel(request.sessionUser!.id)
      if (!channel) return reply.status(404).send({ error: 'No channel' })
      const { seriesId } = request.params as { seriesId: string }

      const existing = await showDb.liveShowSeries.findFirst({
        where: { id: seriesId, channelId: channel.id },
      })
      if (!existing) return reply.status(404).send({ error: 'Series not found' })

      if (parsed.data.recurrenceEnabled) {
        const banError = await restrictionErrorMessage(
          fastify.prisma,
          request.sessionUser!.id,
          'LIVE_SHOW_BOOKING',
        )
        if (banError) return reply.status(403).send({ error: banError })
      }

      const data: Record<string, unknown> = { ...parsed.data }
      if ('description' in data) data.description = parsed.data.description || null
      if ('tagline' in data) data.tagline = parsed.data.tagline || null
      if ('scheduleNote' in data) data.scheduleNote = parsed.data.scheduleNote || null

      const series = await showDb.liveShowSeries.update({
        where: { id: existing.id },
        data,
      })
      await generateRecurringEpisodes(series, request.sessionUser!.id)
      return reply.send({
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

      const banError = await restrictionErrorMessage(
        fastify.prisma,
        request.sessionUser!.id,
        'LIVE_SHOW_BOOKING',
      )
      if (banError) return reply.status(403).send({ error: banError })

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
            title: parsed.data.title?.trim() || liveShowEpisodeTitle(series.name, episodeNumber),
            description: series.description,
            tagline: series.tagline,
            venue: parsed.data.venue || null,
            location: parsed.data.location || null,
            artworkUrl: parsed.data.artworkUrl ?? series.artworkUrl,
            showType: series.showType,
            visibility: series.visibility,
            autoPublish: series.autoPublish,
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

  function serializeEpisode(episode: LiveShowEpisodeDbRow) {
    return {
      ...episode,
      createdAt: episode.createdAt.toISOString(),
      updatedAt: undefined,
      channelId: undefined,
    }
  }

  /** Validates soundId/radioSlotBookingId belong to the caller's own channel. */
  async function validateEpisodeRefs(
    channelId: string,
    refs: { soundId?: string | null; radioSlotBookingId?: string | null },
  ): Promise<string | null> {
    if (refs.soundId) {
      const owned = await fastify.prisma.sound.findFirst({
        where: { id: refs.soundId, channelId },
        select: { id: true },
      })
      if (!owned) return 'Sound item not found'
    }
    if (refs.radioSlotBookingId) {
      const owned = await fastify.prisma.radioSlotBooking.findFirst({
        where: { id: refs.radioSlotBookingId, channelId },
        select: { id: true },
      })
      if (!owned) return 'Radio slot booking not found'
    }
    return null
  }

  // GET /api/me/channel/show-series/:seriesId/live-show-episodes
  fastify.get(
    '/api/me/channel/show-series/:seriesId/live-show-episodes',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(LiveShowEpisodeListSchema, 'LiveShowEpisodeList') },
    },
    async (request, reply) => {
      const channel = await findChannel(request.sessionUser!.id)
      if (!channel) return reply.status(404).send({ error: 'No channel' })
      const { seriesId } = request.params as { seriesId: string }

      const series = await showDb.liveShowSeries.findFirst({
        where: { id: seriesId, channelId: channel.id },
      })
      if (!series) return reply.status(404).send({ error: 'Series not found' })

      const episodes = await showDb.liveShowEpisode.findMany({
        where: { seriesId },
        orderBy: { episodeNumber: 'desc' },
      })
      return reply.send({ episodes: episodes.map(serializeEpisode) })
    },
  )

  // POST /api/me/channel/show-series/:seriesId/live-show-episodes — create a
  // draft (upload) or pending-approval (broadcast) episode; episode numbering
  // follows the same series.nextEpisodeNumber convention as scheduled shows.
  fastify.post(
    '/api/me/channel/show-series/:seriesId/live-show-episodes',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(LiveShowEpisodeViewSchema, 'LiveShowEpisodeView') },
    },
    async (request, reply) => {
      const parsed = CreateLiveShowEpisodeSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const channel = await findChannel(request.sessionUser!.id)
      if (!channel) return reply.status(404).send({ error: 'No channel' })
      const { seriesId } = request.params as { seriesId: string }

      const refError = await validateEpisodeRefs(channel.id, parsed.data)
      if (refError) return reply.status(400).send({ error: refError })

      const episode = await fastify.prisma.$transaction(async (tx) => {
        const transactionDb = showScheduleDb(tx)
        const series = await transactionDb.liveShowSeries.findFirst({
          where: { id: seriesId, channelId: channel.id },
        })
        if (!series) return null

        const episodeNumber = series.episodeNumberEnabled ? series.nextEpisodeNumber : null
        const created = await transactionDb.liveShowEpisode.create({
          data: {
            channelId: channel.id,
            seriesId: series.id,
            episodeNumber,
            title: parsed.data.title?.trim() || liveShowEpisodeTitle(series.name, episodeNumber),
            description: series.description,
            artworkUrl: series.artworkUrl,
            status: parsed.data.source === 'BROADCAST' ? 'PENDING_APPROVAL' : 'DRAFT',
            source: parsed.data.source,
            soundId: parsed.data.soundId ?? null,
            radioSlotBookingId: parsed.data.radioSlotBookingId ?? null,
          },
        })
        if (series.episodeNumberEnabled) {
          await transactionDb.liveShowSeries.update({
            where: { id: series.id },
            data: { nextEpisodeNumber: { increment: 1 } },
          })
        }
        return created
      })

      if (!episode) return reply.status(404).send({ error: 'Series not found' })
      return reply.status(201).send(serializeEpisode(episode))
    },
  )

  // GET /api/me/channel/live-show-episodes/:id
  fastify.get(
    '/api/me/channel/live-show-episodes/:id',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(LiveShowEpisodeViewSchema, 'LiveShowEpisodeView') },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const channel = await findChannel(request.sessionUser!.id)
      if (!channel) return reply.status(404).send({ error: 'No channel' })

      const episode = await showDb.liveShowEpisode.findFirst({
        where: { id: routeParams.id, channelId: channel.id },
      })
      if (!episode) return reply.status(404).send({ error: 'Episode not found' })
      return reply.send(serializeEpisode(episode))
    },
  )

  // PATCH /api/me/channel/live-show-episodes/:id — also how an episode is approved
  // (patch { status: 'APPROVED' }); no separate approve endpoint.
  fastify.patch(
    '/api/me/channel/live-show-episodes/:id',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(LiveShowEpisodeViewSchema, 'LiveShowEpisodeView') },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = PatchLiveShowEpisodeSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const channel = await findChannel(request.sessionUser!.id)
      if (!channel) return reply.status(404).send({ error: 'No channel' })

      const existing = await showDb.liveShowEpisode.findFirst({
        where: { id: routeParams.id, channelId: channel.id },
      })
      if (!existing) return reply.status(404).send({ error: 'Episode not found' })

      const refError = await validateEpisodeRefs(channel.id, parsed.data)
      if (refError) return reply.status(400).send({ error: refError })

      const data: Record<string, unknown> = { ...parsed.data }
      if ('description' in data) data.description = parsed.data.description || null
      if ('soundId' in data) data.soundId = parsed.data.soundId ?? null
      if ('radioSlotBookingId' in data) {
        data.radioSlotBookingId = parsed.data.radioSlotBookingId ?? null
      }

      const episode = await showDb.liveShowEpisode.update({
        where: { id: existing.id },
        data,
      })
      return reply.send(serializeEpisode(episode))
    },
  )
}

export default channelScheduleRoutes
