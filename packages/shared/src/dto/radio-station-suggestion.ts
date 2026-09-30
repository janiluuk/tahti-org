// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const RADIO_STATION_SUGGESTION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const

export const RadioStationSuggestionStatusSchema = z.enum(RADIO_STATION_SUGGESTION_STATUSES)

/** Most pending suggestions one listener can have waiting for review. */
export const MAX_PENDING_RADIO_STATION_SUGGESTIONS = 5

const httpUrl = z
  .string()
  .trim()
  .url()
  .max(2000)
  .refine((value) => /^https?:\/\//i.test(value), { message: 'Use an http(s) link' })

/** POST /api/me/radio-station-suggestions — a listener suggests an internet
 * radio station for the board-curated presets. */
export const CreateRadioStationSuggestionSchema = z.object({
  name: z.string().trim().min(1, 'Station name is required').max(80),
  logoUrl: httpUrl.nullable().optional(),
  language: z.string().trim().min(1, 'Language is required').max(40),
  bitrateKbps: z.number().int().min(8).max(1024).nullable().optional(),
  streamUrl: httpUrl,
})

export type CreateRadioStationSuggestionInput = z.infer<typeof CreateRadioStationSuggestionSchema>

export const RadioStationSuggestionRowSchema = z.object({
  id: z.string(),
  status: RadioStationSuggestionStatusSchema,
  rejectionNote: z.string().nullable(),
  createdAt: z.string(),
  submitter: z.object({ username: z.string(), displayName: z.string() }).nullable(),
  name: z.string(),
  logoUrl: z.string().nullable(),
  language: z.string(),
  bitrateKbps: z.number().int().nullable(),
  streamUrl: z.string(),
})

export type RadioStationSuggestionRow = z.infer<typeof RadioStationSuggestionRowSchema>

export const RadioStationSuggestionListSchema = z.object({
  items: z.array(RadioStationSuggestionRowSchema),
})

export const RadioStationSuggestionCreatedSchema = z.object({
  id: z.string(),
  status: RadioStationSuggestionStatusSchema,
})
