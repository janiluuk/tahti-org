// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  BroadcastPreflightViewSchema,
  LIVE_LOCKED_PREFLIGHT_FIELDS,
  PatchBroadcastPreflightSchema,
  openApiResponse,
  type BroadcastPreflightView,
  type BroadcastSessionState,
  type PatchBroadcastPreflightInput,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import {
  attachSeriesToBroadcast,
  ensurePlannedShowFilled,
  findPlannedBooking,
  findShowSession,
  isOwnMediaUrl,
  updateBroadcastShowInfo,
  type BroadcastShowRow,
} from '../../lib/broadcast-show-info.js'
import { rerenderMirrorsForSession } from '../../lib/broadcast-ingest.js'

type DraftRow = {
  title: string | null
  tagline: string | null
  showType: BroadcastShowRow['showType'] | null
  visibility: BroadcastShowRow['visibility'] | null
  autoPublish: boolean | null
  seriesId: string | null
  artworkUrl: string | null
}

const LIVE_LOCKED_MESSAGE = "Show type, visibility and series can't change while you're live"

function sessionView(
  session: BroadcastSessionState,
  broadcast: BroadcastShowRow,
  avatarUrl: string | null,
  planned: BroadcastPreflightView['plannedRadioShow'],
  plannedLiveShow: BroadcastPreflightView['plannedLiveShow'],
): BroadcastPreflightView {
  return {
    session,
    title: broadcast.title,
    visibility: broadcast.visibility,
    autoPublish: broadcast.autoPublish,
    showType: broadcast.showType,
    episodeNumber: broadcast.episodeNumber,
    tagline: broadcast.tagline,
    seriesId: broadcast.scheduledLiveShow?.seriesId ?? null,
    artworkUrl: broadcast.artworkUrl,
    coverUrl: broadcast.artworkUrl ?? avatarUrl,
    plannedRadioShow: planned,
    plannedLiveShow,
  }
}

function draftView(
  draft: DraftRow | null,
  defaults: { autoPublish: boolean; avatarUrl: string | null },
  planned: BroadcastPreflightView['plannedRadioShow'],
): BroadcastPreflightView {
  const artworkUrl = draft?.artworkUrl ?? null
  return {
    session: 'NONE',
    title: draft?.title ?? null,
    visibility: draft?.visibility ?? 'PUBLIC',
    autoPublish: draft?.autoPublish ?? defaults.autoPublish,
    showType: draft?.showType ?? planned?.showType ?? 'LIVE_SET',
    episodeNumber: planned?.episodeNumber ?? null,
    tagline: draft?.tagline ?? planned?.tagline ?? null,
    seriesId: draft?.seriesId ?? null,
    artworkUrl,
    coverUrl: artworkUrl ?? defaults.avatarUrl,
    plannedRadioShow: planned,
    plannedLiveShow: null,
  }
}

function changesLockedField(body: PatchBroadcastPreflightInput, broadcast: BroadcastShowRow) {
  const current = {
    showType: broadcast.showType,
    visibility: broadcast.visibility,
    seriesId: broadcast.scheduledLiveShow?.seriesId ?? null,
  }
  return LIVE_LOCKED_PREFLIGHT_FIELDS.some(
    (field) => body[field] !== undefined && body[field] !== current[field],
  )
}

const meBroadcastPreflightRoutes: FastifyPluginAsync = async (fastify) => {
  const channelSelect = {
    id: true,
    slug: true,
    state: true,
    autoPublishBroadcast: true,
    user: { select: { avatarUrl: true } },
  } as const

  // GET /api/me/channel/preflight — show info for the open PREVIEW/LIVE session, or the
  // pre-session draft (session: NONE) before the encoder connects. When a Tahti Radio
  // slot is in the go-live window, auto-fills episode # + tagline.
  fastify.get(
    '/api/me/channel/preflight',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(BroadcastPreflightViewSchema, 'BroadcastPreflightView'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: channelSelect,
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const { session, broadcast } = await findShowSession(fastify.prisma, channel)
      if (!broadcast) {
        const [planned, draft] = await Promise.all([
          findPlannedBooking(fastify.prisma, channel.id, new Date()),
          fastify.prisma.broadcastShowDraft.findUnique({ where: { channelId: channel.id } }),
        ])
        return reply.send(
          draftView(
            draft,
            { autoPublish: channel.autoPublishBroadcast, avatarUrl: channel.user.avatarUrl },
            planned,
          ),
        )
      }

      const filled = await ensurePlannedShowFilled(fastify.prisma, channel.id, broadcast)
      return reply.send(
        sessionView(
          session,
          filled.broadcast,
          channel.user.avatarUrl,
          filled.planned,
          filled.plannedLiveShow,
        ),
      )
    },
  )

  // PATCH /api/me/channel/preflight — partial update. Before the encoder connects it
  // saves the pre-session draft; with a PREVIEW session it edits the session; while
  // LIVE, show type, visibility and series are locked.
  fastify.patch(
    '/api/me/channel/preflight',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(BroadcastPreflightViewSchema, 'BroadcastPreflightView'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = PatchBroadcastPreflightSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const body = parsed.data
      if (Object.keys(body).length === 0) {
        return reply.status(400).send({ error: 'Nothing to update' })
      }
      if (body.artworkUrl && !isOwnMediaUrl(body.artworkUrl, user.username)) {
        return reply
          .status(400)
          .send({ error: 'artworkUrl must be an image uploaded with /api/me/media' })
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: channelSelect,
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const { session, broadcast } = await findShowSession(fastify.prisma, channel)

      if (!broadcast) {
        if (body.seriesId) {
          const series = await fastify.prisma.liveShowSeries.findFirst({
            where: { id: body.seriesId, channelId: channel.id },
            select: { id: true },
          })
          if (!series) return reply.status(404).send({ error: 'Series not found' })
        }
        const fields = {
          title: body.title,
          tagline: body.tagline,
          showType: body.showType,
          visibility: body.visibility,
          autoPublish: body.autoPublish,
          seriesId: body.seriesId,
          artworkUrl: body.artworkUrl,
        }
        const [draft, planned] = await Promise.all([
          fastify.prisma.broadcastShowDraft.upsert({
            where: { channelId: channel.id },
            create: { channelId: channel.id, ...fields },
            update: fields,
          }),
          findPlannedBooking(fastify.prisma, channel.id, new Date()),
        ])
        return reply.send(
          draftView(
            draft,
            { autoPublish: channel.autoPublishBroadcast, avatarUrl: channel.user.avatarUrl },
            planned,
          ),
        )
      }

      if (session === 'LIVE' && changesLockedField(body, broadcast)) {
        return reply.status(409).send({ error: LIVE_LOCKED_MESSAGE })
      }

      const attachedSeriesId = broadcast.scheduledLiveShow?.seriesId ?? null
      if (body.seriesId === null && attachedSeriesId) {
        return reply
          .status(409)
          .send({ error: "A series can't be removed once the encoder is connected" })
      }

      let filled: Awaited<ReturnType<typeof ensurePlannedShowFilled>>
      if (body.seriesId && body.seriesId !== attachedSeriesId) {
        if (broadcast.scheduledLiveShowId) {
          return reply.status(409).send({ error: 'This broadcast is already assigned to a series' })
        }
        const attached = await attachSeriesToBroadcast(
          fastify.prisma,
          channel.id,
          broadcast.id,
          body.seriesId,
        )
        if (!attached) return reply.status(404).send({ error: 'Series not found' })
        filled = {
          broadcast: attached.broadcast,
          planned: null,
          plannedLiveShow: attached.plannedLiveShow,
        }
      } else {
        // Link the planned show first so tagline edits persist against the booking.
        filled = await ensurePlannedShowFilled(fastify.prisma, channel.id, broadcast)
      }

      const updated = await updateBroadcastShowInfo(fastify.prisma, filled.broadcast, {
        title: body.title,
        tagline: body.tagline,
        showType: body.showType,
        visibility: body.visibility,
        autoPublish: body.autoPublish,
        artworkUrl: body.artworkUrl,
      })

      if ((broadcast.visibility === 'PRIVATE') !== (updated.visibility === 'PRIVATE')) {
        await rerenderMirrorsForSession(fastify.prisma, fastify.log, channel, broadcast.id)
      }

      const planned = filled.planned
        ? {
            ...filled.planned,
            episodeNumber: updated.episodeNumber ?? filled.planned.episodeNumber,
            tagline: updated.tagline,
            showType: updated.showType,
          }
        : null

      return reply.send(
        sessionView(session, updated, channel.user.avatarUrl, planned, filled.plannedLiveShow),
      )
    },
  )
}

export default meBroadcastPreflightRoutes
