// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import {
  RADIO_SHOW_GO_LIVE_EARLY_MS,
  plannedRadioShowTitle,
  type BroadcastPreflightView,
  type BroadcastSessionState,
  type BroadcastShowType,
  type BroadcastVisibility,
} from '@tahti/shared'
import { publicMediaUrl } from './public-media-url.js'

export const broadcastShowSelect = {
  id: true,
  title: true,
  visibility: true,
  autoPublish: true,
  showType: true,
  episodeNumber: true,
  tagline: true,
  radioSlotBookingId: true,
  scheduledLiveShowId: true,
  scheduledLiveShow: { select: { seriesId: true } },
  artworkUrl: true,
  wentLiveAt: true,
} as const

export type BroadcastShowRow = {
  id: string
  title: string | null
  visibility: BroadcastVisibility
  autoPublish: boolean
  showType: BroadcastShowType
  episodeNumber: number | null
  tagline: string | null
  radioSlotBookingId: string | null
  scheduledLiveShowId: string | null
  scheduledLiveShow: { seriesId: string } | null
  artworkUrl: string | null
  wentLiveAt: Date | null
}

export type ShowInfoFields = {
  title?: string
  tagline?: string | null
  showType?: BroadcastShowType
  visibility?: BroadcastVisibility
  autoPublish?: boolean
  artworkUrl?: string | null
}

type Planned = BroadcastPreflightView['plannedRadioShow']
type PlannedLiveShow = BroadcastPreflightView['plannedLiveShow']

/**
 * The session show info applies to. A placeholder broadcast kept open by the 24/7
 * fallback rotation (LIVE, never went live) or a stale row on an OFFLINE channel is
 * replaced when the encoder connects, so edits must go to the draft instead.
 */
export async function findShowSession(
  prisma: PrismaClient,
  channel: { id: string; state: string },
): Promise<{ session: BroadcastSessionState; broadcast: BroadcastShowRow | null }> {
  if (channel.state === 'OFFLINE') return { session: 'NONE', broadcast: null }
  const broadcast = await prisma.broadcast.findFirst({
    where: { channelId: channel.id, endedAt: null },
    orderBy: { startedAt: 'desc' },
    select: broadcastShowSelect,
  })
  if (!broadcast) return { session: 'NONE', broadcast: null }
  if (channel.state === 'PREVIEW') return { session: 'PREVIEW', broadcast }
  if (broadcast.wentLiveAt) return { session: 'LIVE', broadcast }
  return { session: 'NONE', broadcast: null }
}

/** The caller's own `/api/me/media/complete` upload, not an arbitrary hotlink. */
export function isOwnMediaUrl(url: string, username: string): boolean {
  const prefix = publicMediaUrl(`media/${username}/`)
  return Boolean(prefix) && url.startsWith(prefix!) && !url.includes('..')
}

export async function findPlannedBooking(prisma: PrismaClient, channelId: string, now: Date) {
  const windowStart = new Date(now.getTime() + RADIO_SHOW_GO_LIVE_EARLY_MS)
  // Active window: startAt - 30m <= now < endAt  ⟺  startAt <= now+30m AND endAt > now
  const booking = await prisma.radioSlotBooking.findFirst({
    where: {
      channelId,
      startAt: { lte: windowStart },
      endAt: { gt: now },
    },
    orderBy: { startAt: 'asc' },
    select: { id: true, startAt: true, endAt: true, note: true, showType: true },
  })
  if (!booking) return null

  const priorCount = await prisma.radioSlotBooking.count({
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

/** Links a session to the radio slot or scheduled show in its go-live window. */
export async function ensurePlannedShowFilled(
  prisma: PrismaClient,
  channelId: string,
  broadcast: BroadcastShowRow,
): Promise<{ broadcast: BroadcastShowRow; planned: Planned; plannedLiveShow: PlannedLiveShow }> {
  const planned = await findPlannedBooking(prisma, channelId, new Date())
  if (!planned) {
    const now = new Date()
    const scheduled = await prisma.scheduledLiveShow.findFirst({
      where: {
        channelId,
        canceledAt: null,
        broadcast: null,
        startAt: {
          lte: new Date(now.getTime() + RADIO_SHOW_GO_LIVE_EARLY_MS),
          gt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
        },
      },
      orderBy: { startAt: 'asc' },
    })
    if (!scheduled) return { broadcast, planned: null, plannedLiveShow: null }

    const updated = broadcast.scheduledLiveShowId
      ? broadcast
      : await prisma.broadcast.update({
          where: { id: broadcast.id },
          data: {
            scheduledLiveShowId: scheduled.id,
            title: broadcast.title ?? scheduled.title,
            description: scheduled.description,
            episodeNumber: broadcast.episodeNumber ?? scheduled.episodeNumber,
            tagline: broadcast.tagline ?? scheduled.tagline,
            showType: scheduled.showType,
            visibility: scheduled.visibility,
            autoPublish: scheduled.autoPublish,
            artworkUrl: scheduled.artworkUrl,
          },
          select: broadcastShowSelect,
        })

    const next = await prisma.scheduledLiveShow.findFirst({
      where: {
        channelId,
        canceledAt: null,
        broadcast: null,
        startAt: { gt: now },
      },
      orderBy: { startAt: 'asc' },
      select: { startAt: true, title: true },
    })
    await prisma.channel.update({
      where: { id: channelId },
      data: {
        nextBroadcastAt: next?.startAt ?? null,
        nextBroadcastNote: next?.title ?? null,
      },
    })

    return {
      broadcast: updated,
      planned: null,
      plannedLiveShow: {
        scheduledShowId: scheduled.id,
        seriesId: scheduled.seriesId,
        startAt: scheduled.startAt.toISOString(),
        episodeNumber: scheduled.episodeNumber,
        title: scheduled.title,
        tagline: updated.tagline,
        showType: updated.showType,
        artworkUrl: updated.artworkUrl,
      },
    }
  }

  // Already linked to this (or any) booking — keep artist edits, just expose planned meta.
  if (broadcast.radioSlotBookingId) {
    return {
      broadcast,
      plannedLiveShow: null,
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

  const updated = await prisma.broadcast.update({
    where: { id: broadcast.id },
    data: {
      radioSlotBookingId: planned.bookingId,
      episodeNumber,
      tagline,
      showType,
      title,
    },
    select: broadcastShowSelect,
  })

  return {
    broadcast: updated,
    plannedLiveShow: null,
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

/** Starts the series' next episode on this session. Null when the series isn't the channel's. */
export async function attachSeriesToBroadcast(
  prisma: PrismaClient,
  channelId: string,
  broadcastId: string,
  seriesId: string,
): Promise<{ broadcast: BroadcastShowRow; plannedLiveShow: NonNullable<PlannedLiveShow> } | null> {
  return prisma.$transaction(async (tx) => {
    const series = await tx.liveShowSeries.findFirst({ where: { id: seriesId, channelId } })
    if (!series) return null
    const episodeNumber = series.episodeNumberEnabled ? series.nextEpisodeNumber : null
    const scheduled = await tx.scheduledLiveShow.create({
      data: {
        channelId,
        seriesId: series.id,
        startAt: new Date(),
        episodeNumber,
        title: series.episodeNumberEnabled ? `${series.name} #${episodeNumber}` : series.name,
        description: series.description,
        tagline: series.tagline,
        showType: series.showType,
        visibility: series.visibility,
        autoPublish: series.autoPublish,
        artworkUrl: series.artworkUrl,
      },
    })
    if (series.episodeNumberEnabled) {
      await tx.liveShowSeries.update({
        where: { id: series.id },
        data: { nextEpisodeNumber: { increment: 1 } },
      })
    }
    const broadcast = await tx.broadcast.update({
      where: { id: broadcastId },
      data: {
        scheduledLiveShowId: scheduled.id,
        title: scheduled.title,
        description: scheduled.description,
        episodeNumber: scheduled.episodeNumber,
        tagline: scheduled.tagline,
        showType: scheduled.showType,
        visibility: scheduled.visibility,
        autoPublish: scheduled.autoPublish,
        artworkUrl: scheduled.artworkUrl,
      },
      select: broadcastShowSelect,
    })
    return {
      broadcast,
      plannedLiveShow: {
        scheduledShowId: scheduled.id,
        seriesId: series.id,
        startAt: scheduled.startAt.toISOString(),
        episodeNumber: scheduled.episodeNumber,
        title: scheduled.title,
        tagline: scheduled.tagline,
        showType: scheduled.showType,
        artworkUrl: scheduled.artworkUrl,
      },
    }
  })
}

/** Writes show info to a session, keeping an auto-generated episode title and its radio slot in step. */
export async function updateBroadcastShowInfo(
  prisma: PrismaClient,
  broadcast: BroadcastShowRow,
  fields: ShowInfoFields,
): Promise<BroadcastShowRow> {
  const data: ShowInfoFields = {}
  if (fields.visibility !== undefined) data.visibility = fields.visibility
  if (fields.autoPublish !== undefined) data.autoPublish = fields.autoPublish
  if (fields.showType !== undefined) data.showType = fields.showType
  if (fields.artworkUrl !== undefined) data.artworkUrl = fields.artworkUrl

  const nextShowType = fields.showType ?? broadcast.showType
  const nextTagline = fields.tagline !== undefined ? fields.tagline : broadcast.tagline

  if (fields.tagline !== undefined || fields.showType !== undefined) {
    if (fields.tagline !== undefined) data.tagline = fields.tagline
    const ep = broadcast.episodeNumber
    if (ep != null) {
      const prevAuto = plannedRadioShowTitle(ep, broadcast.tagline, broadcast.showType)
      if (!broadcast.title || broadcast.title === prevAuto) {
        data.title = plannedRadioShowTitle(ep, nextTagline, nextShowType)
      }
    }
  }
  if (fields.title !== undefined) data.title = fields.title

  if (Object.keys(data).length === 0) return broadcast

  const updated = await prisma.broadcast.update({
    where: { id: broadcast.id },
    data,
    select: broadcastShowSelect,
  })

  if (
    (fields.tagline !== undefined || fields.showType !== undefined) &&
    updated.radioSlotBookingId
  ) {
    await prisma.radioSlotBooking.update({
      where: { id: updated.radioSlotBookingId },
      data: {
        ...(fields.tagline !== undefined ? { note: fields.tagline } : {}),
        ...(fields.showType !== undefined ? { showType: fields.showType } : {}),
      },
    })
  }
  return updated
}

/**
 * Moves the pre-session draft onto the session the encoder just opened, then
 * deletes it. Fields the artist set in the draft win over series and planned-show
 * defaults. Returns the session's visibility, or null when there was no draft.
 */
export async function applyShowDraftOnConnect(
  prisma: PrismaClient,
  channelId: string,
  broadcastId: string,
): Promise<BroadcastVisibility | null> {
  const draft = await prisma.broadcastShowDraft.findUnique({ where: { channelId } })
  if (!draft) return null

  let broadcast = await prisma.broadcast.findUniqueOrThrow({
    where: { id: broadcastId },
    select: broadcastShowSelect,
  })
  const attached = draft.seriesId
    ? await attachSeriesToBroadcast(prisma, channelId, broadcastId, draft.seriesId)
    : null
  broadcast = attached
    ? attached.broadcast
    : (await ensurePlannedShowFilled(prisma, channelId, broadcast)).broadcast

  const fields: ShowInfoFields = {}
  if (draft.title !== null) fields.title = draft.title
  if (draft.tagline !== null) fields.tagline = draft.tagline
  if (draft.showType !== null) fields.showType = draft.showType
  if (draft.visibility !== null) fields.visibility = draft.visibility
  if (draft.autoPublish !== null) fields.autoPublish = draft.autoPublish
  if (draft.artworkUrl !== null) fields.artworkUrl = draft.artworkUrl
  const applied = await updateBroadcastShowInfo(prisma, broadcast, fields)

  await prisma.broadcastShowDraft.deleteMany({ where: { channelId } })
  return applied.visibility
}
