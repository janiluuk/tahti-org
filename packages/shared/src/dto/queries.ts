// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const UserSearchQuerySchema = z.object({
  q: z.string().max(64).optional(),
})

export const OEmbedQuerySchema = z.object({
  url: z.string().url().max(2048),
  format: z.literal('json').optional(),
})

export const YearPathParamSchema = z.object({
  year: z.string().regex(/^\d{4}$/),
})

export function yearFromPathParams(params: unknown): number | null {
  const parsed = YearPathParamSchema.safeParse(params)
  if (!parsed.success) return null
  return parseInt(parsed.data.year, 10)
}

export const CollectionListQuerySchema = z.object({
  expand: z.literal('items').optional(),
})

export const VenueCalendarQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

export const MixcloudOAuthCallbackQuerySchema = z.object({
  code: z.string().min(1).max(512).optional(),
  state: z.string().min(8).max(128).optional(),
  error: z.string().max(128).optional(),
})

/** Studio release track download (`?format=flac` only; default MP3/stream key). */
export const MeReleaseTrackDownloadQuerySchema = z.object({
  format: z.literal('flac').optional(),
})
