// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Writes ScheduledLiveShow rows for a recurring LiveShowSeries, given a list
// of already-computed occurrence instants. Lives in @tahti/db (not apps/api
// or apps/worker) so both sides can call it without crossing an app
// boundary: apps/api runs it once, synchronously, right after an artist
// turns recurrence on or edits it (so they see results immediately instead
// of waiting for the next cron tick), and apps/worker's daily
// live-show-recurrence-generate cron re-runs it for every recurrence-enabled
// series to keep the horizon rolling forward over time. Idempotent either
// way — see generateForSeries.
//
// The occurrence instants themselves come from
// @tahti/shared's nextRecurrenceOccurrences/isValidRecurrenceRule (pure date
// math, no Prisma) — not imported here, since @tahti/shared already depends
// on @tahti/db and importing it back would create a package cycle. Callers
// compute occurrences with @tahti/shared and pass them in.

import type { PrismaClient } from '@prisma/client'

export type RecurringSeriesInput = {
  id: string
  channelId: string
  /** The channel owner — restrictions are user-scoped, not channel-scoped. */
  userId: string
  name: string
  episodeNumberEnabled: boolean
  nextEpisodeNumber: number
  description: string | null
  tagline: string | null
  artworkUrl: string | null
  showType: 'LIVE_SET' | 'TALK'
  visibility: 'PUBLIC' | 'FAN_ONLY'
  autoArchive: boolean
}

function episodeTitle(seriesName: string, episodeNumber: number | null): string {
  return episodeNumber == null ? seriesName : `${seriesName} #${episodeNumber}`
}

export type ActiveRestriction = { reason: string; expiresAt: Date | null }

/** The user's currently-active restriction of one type, if any — checked
 * before booking (manual episode scheduling and recurrence generation),
 * uploads, and login (see AccountRestrictionType). A restriction with a
 * past expiresAt is treated as inactive without needing a cleanup job to
 * touch the row. */
export async function getActiveRestriction(
  prisma: PrismaClient,
  userId: string,
  type: 'LIVE_SHOW_BOOKING' | 'UPLOAD' | 'LOGIN',
): Promise<ActiveRestriction | null> {
  const restriction = await prisma.accountRestriction.findFirst({
    where: {
      userId,
      type,
      liftedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { bannedAt: 'desc' },
    select: { reason: true, expiresAt: true },
  })
  return restriction
}

const RESTRICTION_ACTION_LABEL = {
  LIVE_SHOW_BOOKING: 'Booking',
  UPLOAD: 'Uploads',
  LOGIN: 'Sign-in',
} as const

/** One-call convenience for the common "block this request if restricted"
 * check — every upload route (and login, and booking) needs the same
 * lookup-then-format sequence, so route handlers can do
 * `const err = await uploadRestrictionError(...); if (err) return reply.status(403).send({ error: err })`
 * instead of repeating the ternary at every call site. Returns null when
 * there's no active restriction. */
export async function restrictionErrorMessage(
  prisma: PrismaClient,
  userId: string,
  type: 'LIVE_SHOW_BOOKING' | 'UPLOAD' | 'LOGIN',
): Promise<string | null> {
  const restriction = await getActiveRestriction(prisma, userId, type)
  if (!restriction) return null
  const action = RESTRICTION_ACTION_LABEL[type]
  return restriction.expiresAt
    ? `${action} is blocked until ${restriction.expiresAt.toLocaleString()}: ${restriction.reason}`
    : `${action} is blocked: ${restriction.reason}`
}

/** Creates missing ScheduledLiveShow rows for one recurring series from a
 * caller-supplied list of occurrence instants. Idempotent — only fills in
 * occurrences that don't already have a (non-canceled) ScheduledLiveShow at
 * that exact instant, so calling this after every save is safe alongside
 * the daily cron. Returns the number of episodes created. A channel under
 * an active booking ban generates nothing — checked here (not just at the
 * artist-facing save action) so the daily cron can't route around a ban
 * that was issued after recurrence was already turned on. */
export async function generateForSeries(
  prisma: PrismaClient,
  series: RecurringSeriesInput,
  occurrences: Date[],
): Promise<number> {
  if (occurrences.length === 0) return 0
  if (await getActiveRestriction(prisma, series.userId, 'LIVE_SHOW_BOOKING')) return 0

  const existing = await prisma.scheduledLiveShow.findMany({
    where: { seriesId: series.id, startAt: { in: occurrences }, canceledAt: null },
    select: { startAt: true },
  })
  const existingMs = new Set(existing.map((e) => e.startAt.getTime()))
  const toCreate = occurrences
    .filter((o) => !existingMs.has(o.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())
  if (toCreate.length === 0) return 0

  let nextNumber = series.nextEpisodeNumber
  for (const startAt of toCreate) {
    const episodeNumber = series.episodeNumberEnabled ? nextNumber : null
    await prisma.scheduledLiveShow.create({
      data: {
        channelId: series.channelId,
        seriesId: series.id,
        startAt,
        episodeNumber,
        title: episodeTitle(series.name, episodeNumber),
        description: series.description,
        tagline: series.tagline,
        artworkUrl: series.artworkUrl,
        showType: series.showType,
        visibility: series.visibility,
        autoArchive: series.autoArchive,
      },
    })
    if (series.episodeNumberEnabled) nextNumber++
  }
  if (series.episodeNumberEnabled && nextNumber !== series.nextEpisodeNumber) {
    await prisma.liveShowSeries.update({
      where: { id: series.id },
      data: { nextEpisodeNumber: nextNumber },
    })
  }
  return toCreate.length
}

/** Same lookup+update pair apps/api's channel-schedule route already runs
 * after a manual scheduleLiveShowEpisode call — shared here so recurrence
 * generation (worker cron, or the immediate pass on save) keeps
 * Channel.nextBroadcastAt/-Note in sync the same way. */
export async function syncNextBroadcast(prisma: PrismaClient, channelId: string): Promise<void> {
  const next = await prisma.scheduledLiveShow.findFirst({
    where: { channelId, canceledAt: null, broadcast: null, startAt: { gt: new Date() } },
    orderBy: { startAt: 'asc' },
    select: { startAt: true, title: true },
  })
  await prisma.channel.update({
    where: { id: channelId },
    data: { nextBroadcastAt: next?.startAt ?? null, nextBroadcastNote: next?.title ?? null },
  })
}
