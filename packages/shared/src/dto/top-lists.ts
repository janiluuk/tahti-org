// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const TopListPeriodSchema = z.enum(['week', 'month', 'half_year', 'all_time'])
export type TopListPeriodInput = z.infer<typeof TopListPeriodSchema>

export const TopListDimensionSchema = z.enum(['type', 'genre'])
export const TopListSortSchema = z.enum(['desc', 'asc'])

export const TopListEntrySchema = z.object({
  soundId: z.string(),
  listens: z.number().int(),
  title: z.string(),
  artistName: z.string(),
  channelSlug: z.string(),
  bannerUrl: z.string().nullable(),
  genre: z.string().nullable(),
  contentType: z.string(),
})

export const TopListResponseSchema = z.object({
  period: TopListPeriodSchema,
  entries: z.array(TopListEntrySchema),
})

export const TopListBucketSchema = z.object({
  bucket: z.string(),
  entries: z.array(TopListEntrySchema),
})

export const TopListsByDimensionResponseSchema = z.object({
  period: TopListPeriodSchema,
  dimension: TopListDimensionSchema,
  sort: TopListSortSchema,
  buckets: z.array(TopListBucketSchema),
})

export const TopListRanksResponseSchema = z.object({
  ranks: z.record(z.string(), z.number().int()),
})

export const TopListsOptOutPatchSchema = z.object({ topListsOptOut: z.boolean() })
export const TopListsOptOutResponseSchema = z.object({ topListsOptOut: z.boolean() })

export const LatestReleaseCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string(),
  releaseDate: z.string().datetime(),
  artworkUrl: z.string().nullable(),
  smartLinkSlug: z.string(),
  artistDisplayName: z.string(),
})

export const LatestReleasesResponseSchema = z.object({
  releases: z.array(LatestReleaseCardSchema),
})
