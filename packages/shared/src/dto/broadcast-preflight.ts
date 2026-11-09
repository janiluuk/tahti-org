// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** PRIVATE: only the owning artist can hear the session (test runs). */
export const BroadcastVisibilitySchema = z.enum(['PUBLIC', 'FAN_ONLY', 'PRIVATE'])

export type BroadcastVisibility = z.infer<typeof BroadcastVisibilitySchema>

/** Series and scheduled shows are listed on the public schedule, so they can't be PRIVATE. */
export const ScheduledShowVisibilitySchema = z.enum(['PUBLIC', 'FAN_ONLY'])

/** Live session format — music/DJ set vs spoken talk (solo or with guests). */
export const BroadcastShowTypeSchema = z.enum(['LIVE_SET', 'TALK'])

export type BroadcastShowType = z.infer<typeof BroadcastShowTypeSchema>

/** Artists may go live for a booked Tahti Radio slot from this far before startAt. */
export const RADIO_SHOW_GO_LIVE_EARLY_MS = 30 * 60 * 1000

export const PatchBroadcastPreflightSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(140).optional(),
  tagline: z.string().trim().max(200).nullable().optional(),
  showType: BroadcastShowTypeSchema.optional(),
  visibility: BroadcastVisibilitySchema.optional(),
  autoPublish: z.boolean().optional(),
  /** null clears a series picked in the pre-session draft. */
  seriesId: z.string().min(1).nullable().optional(),
  /** Per-broadcast cover from `POST /api/me/media/prepare` + `/complete`; null clears it. */
  artworkUrl: z.string().url().max(2_000).nullable().optional(),
})

/** Fields that can't change once the session is public. */
export const LIVE_LOCKED_PREFLIGHT_FIELDS = ['showType', 'visibility', 'seriesId'] as const

/** NONE: no encoder session yet, edits go to the pre-session draft. */
export const BroadcastSessionStateSchema = z.enum(['NONE', 'PREVIEW', 'LIVE'])

export type BroadcastSessionState = z.infer<typeof BroadcastSessionStateSchema>

export type PatchBroadcastPreflightInput = z.infer<typeof PatchBroadcastPreflightSchema>

export const PlannedRadioShowSchema = z.object({
  bookingId: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  // Use .min(1) not .positive() — zod-to-json-schema openApi3 emits boolean
  // exclusiveMinimum, which Fastify/AJV rejects (must be a number).
  episodeNumber: z.number().int().min(1),
  tagline: z.string().nullable(),
  showType: BroadcastShowTypeSchema,
})

export type PlannedRadioShow = z.infer<typeof PlannedRadioShowSchema>

export const PlannedLiveShowSchema = z.object({
  scheduledShowId: z.string(),
  seriesId: z.string(),
  startAt: z.string(),
  episodeNumber: z.number().int().min(1).nullable(),
  title: z.string(),
  tagline: z.string().nullable(),
  showType: BroadcastShowTypeSchema,
  artworkUrl: z.string().nullable(),
})

export const BroadcastPreflightViewSchema = z.object({
  session: BroadcastSessionStateSchema,
  title: z.string().nullable(),
  visibility: BroadcastVisibilitySchema,
  autoPublish: z.boolean(),
  showType: BroadcastShowTypeSchema,
  episodeNumber: z.number().int().min(1).nullable(),
  tagline: z.string().nullable(),
  seriesId: z.string().nullable(),
  /** Cover set for this broadcast; null when unset. */
  artworkUrl: z.string().nullable(),
  /** artworkUrl, falling back to the artist's profile avatar. */
  coverUrl: z.string().nullable(),
  plannedRadioShow: PlannedRadioShowSchema.nullable(),
  plannedLiveShow: PlannedLiveShowSchema.nullable(),
})

export type BroadcastPreflightView = z.infer<typeof BroadcastPreflightViewSchema>

export function broadcastShowTypeLabel(showType: BroadcastShowType): string {
  return showType === 'TALK' ? 'Talk' : 'Live set'
}

/** Compose the default show title from type, episode number + optional tagline. */
export function plannedRadioShowTitle(
  episodeNumber: number,
  tagline: string | null | undefined,
  showType: BroadcastShowType = 'LIVE_SET',
): string {
  const base = showType === 'TALK' ? `Talk #${episodeNumber}` : `Show #${episodeNumber}`
  const line = tagline?.trim()
  return line ? `${base} — ${line}` : base
}
