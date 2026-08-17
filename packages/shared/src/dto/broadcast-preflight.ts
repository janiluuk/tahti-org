// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const BroadcastVisibilitySchema = z.enum(['PUBLIC', 'FAN_ONLY'])

export type BroadcastVisibility = z.infer<typeof BroadcastVisibilitySchema>

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
  autoArchive: z.boolean().optional(),
  seriesId: z.string().optional(),
})

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
  title: z.string().nullable(),
  visibility: BroadcastVisibilitySchema,
  autoArchive: z.boolean(),
  showType: BroadcastShowTypeSchema,
  episodeNumber: z.number().int().min(1).nullable(),
  tagline: z.string().nullable(),
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
