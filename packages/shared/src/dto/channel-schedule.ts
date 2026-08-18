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
})

export const ScheduleLiveShowSchema = z.object({
  startAt: z.string().datetime(),
  venue: z.string().trim().max(200).nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  artworkUrl: z.string().url().max(2_000).nullable().optional(),
})

export const LiveShowSeriesViewSchema = CreateLiveShowSeriesSchema.extend({
  id: z.string(),
  description: z.string().nullable(),
  tagline: z.string().nullable(),
  artworkUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
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
export type LiveShowSeriesView = z.infer<typeof LiveShowSeriesViewSchema>
export type ScheduledLiveShowView = z.infer<typeof ScheduledLiveShowViewSchema>

export function liveShowEpisodeTitle(seriesName: string, episodeNumber: number | null): string {
  return episodeNumber == null ? seriesName : `${seriesName} #${episodeNumber}`
}
