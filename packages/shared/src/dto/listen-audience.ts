// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { StatsRangeQuerySchema } from './artist-stats.js'

const DaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** Range params shared by the Studio audience stats routes, same as
 * `/api/me/stats/plays` plus an optional single track. */
export const StatsAudienceWindowQuerySchema = z.object({
  range: StatsRangeQuerySchema,
  from: DaySchema.optional(),
  to: DaySchema.optional(),
  soundId: z.string().min(1).max(64).optional(),
  includeBots: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
})

export const StatsAudienceDimensionSchema = z.enum([
  'browser',
  'os',
  'deviceType',
  'deviceVendor',
  'source',
])

export type StatsAudienceDimension = z.infer<typeof StatsAudienceDimensionSchema>

export const StatsAudienceQuerySchema = StatsAudienceWindowQuerySchema.extend({
  dimension: StatsAudienceDimensionSchema,
})

export const StatsShareItemSchema = z.object({
  name: z.string(),
  count: z.number().int().nonnegative(),
  share: z.number().min(0).max(1),
})

export type StatsShareItem = z.infer<typeof StatsShareItemSchema>

export const StatsAudienceResponseSchema = z.object({
  dimension: StatsAudienceDimensionSchema,
  total: z.number().int().nonnegative(),
  minBucket: z.number().int().min(1),
  items: z.array(StatsShareItemSchema),
})

export type StatsAudienceResponse = z.infer<typeof StatsAudienceResponseSchema>

export const StatsLocationItemSchema = StatsShareItemSchema.extend({
  countryCode: z.string().nullable(),
})

export type StatsLocationItem = z.infer<typeof StatsLocationItemSchema>

export const StatsLocationsResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  minBucket: z.number().int().min(1),
  countries: z.array(StatsLocationItemSchema),
  cities: z.array(StatsLocationItemSchema),
})

export type StatsLocationsResponse = z.infer<typeof StatsLocationsResponseSchema>
