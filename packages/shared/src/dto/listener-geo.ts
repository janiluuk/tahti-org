// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const ListenerGeoPeriodSchema = z.enum(['7d', '30d', 'all'])

export const ListenerGeoPointSchema = z.object({
  countryCode: z.string(),
  displayName: z.string(),
  count: z.number().int().nonnegative(),
})

export const ListenerGeoResponseSchema = z.object({
  period: ListenerGeoPeriodSchema,
  geo: z.array(ListenerGeoPointSchema),
})

export type ListenerGeoPeriod = z.infer<typeof ListenerGeoPeriodSchema>
export type ListenerGeoPoint = z.infer<typeof ListenerGeoPointSchema>
