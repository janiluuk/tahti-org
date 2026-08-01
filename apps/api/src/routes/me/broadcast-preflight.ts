// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  BroadcastPreflightViewSchema,
  PatchBroadcastPreflightSchema,
  RADIO_SHOW_GO_LIVE_EARLY_MS,
  openApiResponse,
  plannedRadioShowTitle,
  type BroadcastPreflightView,
  type BroadcastShowType,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

type BroadcastRow = {
  id: string
  title: string | null
  visibility: 'PUBLIC' | 'FAN_ONLY'
  autoArchive: boolean
  showType: BroadcastShowType
  episodeNumber: number | null
  tagline: string | null
  radioSlotBookingId: string | null
}

const broadcastSelect = {
  id: true,
  title: true,
  visibility: true,
  autoArchive: true,
  showType: true,
  episodeNumber: true,
  tagline: true,
  radioSlotBookingId: true,
} as const

function toView(
  broadcast: Pick<
    BroadcastRow,
    'title' | 'visibility' | 'autoArchive' | 'showType' | 'episodeNumber' | 'tagline'
  >,
  planned: BroadcastPreflightView['plannedRadioShow'],
): BroadcastPreflightView {
  return {
    title: broadcast.title,
    visibility: broadcast.visibility,
    autoArchive: broadcast.autoArchive,
    showType: broadcast.showType,
    episodeNumber: broadcast.episodeNumber,
    tagline: broadcast.tagline,
    plannedRadioShow: planned,
  }
}

const meBroadcastPreflightRoutes: FastifyPluginAsync = async (fastify) => {
  async function findPlannedBooking(channelId: string, now: Date) {
    const windowStart = new Date(now.getTime() + RADIO_SHOW_GO_LIVE_EARLY_MS)
    // Active window: startAt - 30m <= now < endAt  ⟺  startAt <= now+30m AND endAt > now
    const booking = await fastify.prisma.radioSlotBooking.findFirst({
      where: {
        channelId,
        startAt: { lte: windowStart },
        endAt: { gt: now },
      },
      orderBy: { startAt: 'asc' },
      select: { id: true, startAt: true, endAt: true, note: true, showType: true },
    })
    if (!booking) return null

    const priorCount = await fastify.prisma.radioSlotBooking.count({
      where: { channelId, startAt: { lt: booking.startAt } },
    })
    return {
      bookingId: booking.id,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      episodeNumber: priorCount + 1,
      tagline: booking.note,
      showType: booking.showType as BroadcastShowType,
    }
  }

  async function ensurePlannedShowFilled(
    channelId: string,
    broadcast: BroadcastRow,
  ): Promise<{ broadcast: BroadcastRow; planned: BroadcastPreflightView['plannedRadioShow'] }> {
    const planned = await findPlannedBooking(channelId, new Date())
    if (!planned) {
      return { broadcast, planned: null }
    }

    // Already linked to this (or any) booking — keep artist edits, just expose planned meta.
    if (broadcast.radioSlotBookingId) {
      return {
        broadcast,
        planned: {
          ...planned,
          tagline: broadcast.tagline ?? planned.tagline,
          episodeNumber: broadcast.episodeNumber ?? planned.episodeNumber,
          showType: broadcast.showType,
        },
      }
    }

    const tagline = broadcast.tagline ?? planned.tagline
    const episodeNumber = broadcast.episodeNumber ?? planned.episodeNumber
    const showType = planned.showType
    const title = broadcast.title ?? plannedRadioShowTitle(episodeNumber, tagline, showType)

    const updated = await fastify.prisma.broadcast.update({
      where: { id: broadcast.id },
      data: {
        radioSlotBookingId: planned.bookingId,
        episodeNumber,
        tagline,
        showType,
        title,
      },
      select: broadcastSelect,
    })

    return {
      broadcast: updated,
      planned: {
        bookingId: planned.bookingId,
        startAt: planned.startAt,
        endAt: planned.endAt,
        episodeNumber,
        tagline,
        showType,
      },
    }
  }

  // GET /api/me/channel/preflight — show name / visibility / auto-archive for the
  // active (PREVIEW or LIVE) broadcast session. Broadcasting Setup step 3.
  // When a Tahti Radio slot is in the go-live window, auto-fills episode # + tagline.
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
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const broadcast = await fastify.prisma.broadcast.findFirst({
        where: { channelId: channel.id, endedAt: null },
        orderBy: { startedAt: 'desc' },
        select: broadcastSelect,
      })

      if (!broadcast) {
        const planned = await findPlannedBooking(channel.id, new Date())
        return reply.send(
          toView(
            {
              title: null,
              visibility: 'PUBLIC',
              autoArchive: true,
              showType: planned?.showType ?? 'LIVE_SET',
              episodeNumber: planned?.episodeNumber ?? null,
              tagline: planned?.tagline ?? null,
            },
            planned,
          ),
        )
      }

      const filled = await ensurePlannedShowFilled(channel.id, broadcast)
      return reply.send(toView(filled.broadcast, filled.planned))
    },
  )

  // PATCH /api/me/channel/preflight — set show name / visibility / auto-archive
  // on the active broadcast session before going live.
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

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      let broadcast = await fastify.prisma.broadcast.findFirst({
        where: { channelId: channel.id, endedAt: null },
        orderBy: { startedAt: 'desc' },
        select: broadcastSelect,
      })
      if (!broadcast) return reply.status(409).send({ error: 'No active broadcast session' })

      // Link planned show first so tagline edits persist against the booking.
      const filled = await ensurePlannedShowFilled(channel.id, broadcast)
      broadcast = filled.broadcast

      const data: {
        title?: string
        tagline?: string | null
        showType?: BroadcastShowType
        visibility?: 'PUBLIC' | 'FAN_ONLY'
        autoArchive?: boolean
      } = {}
      if (body.visibility !== undefined) data.visibility = body.visibility
      if (body.autoArchive !== undefined) data.autoArchive = body.autoArchive
      if (body.showType !== undefined) data.showType = body.showType

      const nextShowType = body.showType ?? broadcast.showType
      const nextTagline = body.tagline !== undefined ? body.tagline : broadcast.tagline

      if (body.tagline !== undefined || body.showType !== undefined) {
        if (body.tagline !== undefined) data.tagline = body.tagline
        const ep = broadcast.episodeNumber
        if (ep != null) {
          const prevAuto = plannedRadioShowTitle(ep, broadcast.tagline, broadcast.showType)
          if (!broadcast.title || broadcast.title === prevAuto) {
            data.title = plannedRadioShowTitle(ep, nextTagline, nextShowType)
          }
        }
      }
      if (body.title !== undefined) data.title = body.title

      const updated = await fastify.prisma.broadcast.update({
        where: { id: broadcast.id },
        data,
        select: broadcastSelect,
      })

      if (
        (body.tagline !== undefined || body.showType !== undefined) &&
        updated.radioSlotBookingId
      ) {
        await fastify.prisma.radioSlotBooking.update({
          where: { id: updated.radioSlotBookingId },
          data: {
            ...(body.tagline !== undefined ? { note: body.tagline } : {}),
            ...(body.showType !== undefined ? { showType: body.showType } : {}),
          },
        })
      }

      const planned = filled.planned
        ? {
            ...filled.planned,
            episodeNumber: updated.episodeNumber ?? filled.planned.episodeNumber,
            tagline: updated.tagline,
            showType: updated.showType,
          }
        : null

      return reply.send(toView(updated, planned))
    },
  )
}

export default meBroadcastPreflightRoutes
