// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const InsightsPeriodQuerySchema = z.enum(['7d', '30d', 'all']).default('30d')

export const TrackInsightsResponseSchema = z.object({
  title: z.string(),
  period: z.enum(['7d', '30d', 'all']),
  totalDownloads: z.number().int().nonnegative(),
  totalPlays: z.number().int().nonnegative(),
  daily: z.array(
    z.object({
      date: z.string(),
      downloads: z.number().int().nonnegative(),
    }),
  ),
  countries: z.array(
    z.object({
      countryCode: z.string(),
      displayName: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
  /** Unique listeners (fingerprints) per UTC hour, index 0 = 00:00. */
  hourlyUsers: z.array(z.number().int().nonnegative()).length(24),
  /** Unique listeners per weekday, Monday-first (same order as History). */
  dayOfWeekUsers: z.tuple([
    z.number().int().nonnegative(),
    z.number().int().nonnegative(),
    z.number().int().nonnegative(),
    z.number().int().nonnegative(),
    z.number().int().nonnegative(),
    z.number().int().nonnegative(),
    z.number().int().nonnegative(),
  ]),
  /** Unique listeners per UTC calendar day in the period window. */
  dailyUsers: z.array(
    z.object({
      date: z.string(),
      users: z.number().int().nonnegative(),
    }),
  ),
})

export type TrackInsightsResponse = z.infer<typeof TrackInsightsResponseSchema>
