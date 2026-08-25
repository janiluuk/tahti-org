// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { BroadcastShowTypeSchema, BroadcastVisibilitySchema } from './broadcast-preflight.js'

export const ChannelSchedulePatchSchema = z.object({
  nextBroadcastAt: z.string().datetime().nullable().optional(),
  nextBroadcastNote: z.string().max(200).nullable().optional(),
})

export type ChannelSchedulePatch = z.infer<typeof ChannelSchedulePatchSchema>

export const CreateLiveShowSeriesSchema = z.object({
  name: z.string().trim().min(1, 'Series name is required').max(140),
  description: z.string().trim().max(2_000).nullable().optional(),
  tagline: z.string().trim().max(200).nullable().optional(),
  artworkUrl: z.string().url().max(2_000).nullable().optional(),
  showType: BroadcastShowTypeSchema.default('LIVE_SET'),
  visibility: BroadcastVisibilitySchema.default('PUBLIC'),
  autoArchive: z.boolean().default(true),
  episodeNumberEnabled: z.boolean().default(true),
  nextEpisodeNumber: z.number().int().min(1).max(100_000).default(1),
  /// Preferred length for this show's radio-slot bookings, hours.
  intervalHours: z.union([z.literal(1), z.literal(2)]).default(1),
  scheduleNote: z.string().trim().max(200).nullable().optional(),
  recurrenceEnabled: z.boolean().default(false),
  /// 0=Sunday..6=Saturday.
  recurrenceDays: z.array(z.number().int().min(0).max(6)).max(7).default([]),
  recurrenceTimeOfDay: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Use 24h HH:mm')
    .nullable()
    .optional(),
  recurrenceDurationMin: z.number().int().min(15).max(720).nullable().optional(),
  /// IANA zone, e.g. "Europe/Helsinki" — captured client-side.
  recurrenceTimezone: z.string().trim().max(100).nullable().optional(),
  recurrenceHorizonDays: z.number().int().min(7).max(90).default(28),
})

export const PatchLiveShowSeriesSchema = CreateLiveShowSeriesSchema.partial()

export const ScheduleLiveShowSchema = z.object({
  startAt: z.string().datetime(),
  title: z.string().trim().max(200).nullable().optional(),
  venue: z.string().trim().max(200).nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  artworkUrl: z.string().url().max(2_000).nullable().optional(),
})

export const LiveShowSeriesViewSchema = CreateLiveShowSeriesSchema.extend({
  id: z.string(),
  description: z.string().nullable(),
  tagline: z.string().nullable(),
  artworkUrl: z.string().nullable(),
  scheduleNote: z.string().nullable(),
  createdAt: z.string().datetime(),
})

export const LiveShowEpisodeSourceSchema = z.enum(['UPLOAD', 'BROADCAST'])
export const LiveShowEpisodeStatusSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SCHEDULED',
  'LIVE',
])

export const CreateLiveShowEpisodeSchema = z.object({
  source: LiveShowEpisodeSourceSchema,
  title: z.string().trim().max(200).optional(),
  archiveItemId: z.string().nullable().optional(),
  radioSlotBookingId: z.string().nullable().optional(),
})

export const PatchLiveShowEpisodeSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2_000).nullable().optional(),
  artworkUrl: z.string().url().max(2_000).nullable().optional(),
  status: LiveShowEpisodeStatusSchema.optional(),
  archiveItemId: z.string().nullable().optional(),
  radioSlotBookingId: z.string().nullable().optional(),
})

export const LiveShowEpisodeViewSchema = z.object({
  id: z.string(),
  seriesId: z.string(),
  episodeNumber: z.number().int().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  artworkUrl: z.string().nullable(),
  status: LiveShowEpisodeStatusSchema,
  source: LiveShowEpisodeSourceSchema,
  archiveItemId: z.string().nullable(),
  radioSlotBookingId: z.string().nullable(),
  createdAt: z.string().datetime(),
})

export const LiveShowEpisodeListSchema = z.object({
  episodes: z.array(LiveShowEpisodeViewSchema),
})

export const ScheduledLiveShowViewSchema = z.object({
  id: z.string(),
  seriesId: z.string(),
  startAt: z.string().datetime(),
  episodeNumber: z.number().int().min(1).nullable(),
  title: z.string(),
  description: z.string().nullable(),
  tagline: z.string().nullable(),
  venue: z.string().nullable(),
  location: z.string().nullable(),
  artworkUrl: z.string().nullable(),
  showType: BroadcastShowTypeSchema,
  visibility: BroadcastVisibilitySchema,
  autoArchive: z.boolean(),
})

export const LiveShowSeriesListSchema = z.object({
  series: z.array(LiveShowSeriesViewSchema),
  scheduledShows: z.array(ScheduledLiveShowViewSchema),
})

export type CreateLiveShowSeries = z.infer<typeof CreateLiveShowSeriesSchema>
export type PatchLiveShowSeries = z.infer<typeof PatchLiveShowSeriesSchema>
export type LiveShowSeriesView = z.infer<typeof LiveShowSeriesViewSchema>
export type ScheduledLiveShowView = z.infer<typeof ScheduledLiveShowViewSchema>
export type CreateLiveShowEpisode = z.infer<typeof CreateLiveShowEpisodeSchema>
export type PatchLiveShowEpisode = z.infer<typeof PatchLiveShowEpisodeSchema>
export type LiveShowEpisodeView = z.infer<typeof LiveShowEpisodeViewSchema>

export function liveShowEpisodeTitle(seriesName: string, episodeNumber: number | null): string {
  return episodeNumber == null ? seriesName : `${seriesName} #${episodeNumber}`
}
