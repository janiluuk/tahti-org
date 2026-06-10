// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const StatsRangeQuerySchema = z.enum(['7', '30', 'all']).default('30')

export const StatsPlaysDailyPointSchema = z.object({
  date: z.string(),
  downloads: z.number().int().nonnegative(),
  smartLinkClicks: z.number().int().nonnegative(),
  plays: z.number().int().nonnegative(),
})

export const StatsPlaysResponseSchema = z.object({
  range: z.enum(['7', '30', 'all']),
  windowDays: z.number().int().nonnegative().optional(),
  totalPlays: z.number().int().nonnegative(),
  totalDownloads: z.number().int().nonnegative(),
  totalSmartLinkClicks: z.number().int().nonnegative(),
  daily: z.array(StatsPlaysDailyPointSchema),
  downloadCountries: z.array(
    z.object({
      countryCode: z.string(),
      displayName: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
})

export const StatsTopTrackSchema = z.object({
  archiveItemId: z.string(),
  title: z.string(),
  plays: z.number().int().nonnegative(),
})

export const StatsTopTracksResponseSchema = z.object({
  items: z.array(StatsTopTrackSchema),
})

export const StatsTopCountrySchema = z.object({
  country: z.string(),
  count: z.number().int().nonnegative(),
})

export const StatsTopCountriesResponseSchema = z.object({
  items: z.array(StatsTopCountrySchema),
})

export type StatsRangeQuery = z.infer<typeof StatsRangeQuerySchema>
