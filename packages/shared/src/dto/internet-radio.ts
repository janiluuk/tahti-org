// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

// Client-side only: streamUrl is played directly in the browser (same hls.js
// path as Tahti's own live streams) — never ingested or relayed by Tahti.

export const InternetRadioPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  genre: z.string().nullable(),
  description: z.string().nullable(),
  iconUrl: z.string().nullable(),
  programmingUrl: z.string().nullable(),
  streamUrl: z.string().nullable(),
  /** Board-set: shown in every listener's Listen page radio feed (including
   * anonymous visitors) without them adding it to their own library first. */
  enabled: z.boolean(),
})
export type InternetRadioPreset = z.infer<typeof InternetRadioPresetSchema>

export const InternetRadioPresetListSchema = z.object({
  presets: z.array(InternetRadioPresetSchema),
})

export const UpsertInternetRadioPresetSchema = z.object({
  name: z.string().trim().min(1).max(80),
  genre: z.string().trim().max(40).optional(),
  description: z.string().trim().max(400).optional(),
  iconUrl: z.string().url().optional(),
  programmingUrl: z.string().url().optional(),
  streamUrl: z.string().url().optional(),
  enabled: z.boolean().optional(),
})
export type UpsertInternetRadioPresetInput = z.infer<typeof UpsertInternetRadioPresetSchema>

export const InternetRadioStationSchema = z.object({
  id: z.string(),
  presetId: z.string().nullable(),
  name: z.string(),
  genre: z.string().nullable(),
  description: z.string().nullable(),
  iconUrl: z.string().nullable(),
  programmingUrl: z.string().nullable(),
  streamUrl: z.string().nullable(),
  position: z.number().int(),
})
export type InternetRadioStation = z.infer<typeof InternetRadioStationSchema>

export const InternetRadioStationListSchema = z.object({
  stations: z.array(InternetRadioStationSchema),
})

// Add either { presetId } (copies the preset's current fields as a starting
// point) or the full custom fields — never both.
export const AddInternetRadioStationSchema = z
  .object({
    presetId: z.string().min(1).optional(),
    name: z.string().trim().min(1).max(80).optional(),
    genre: z.string().trim().max(40).optional(),
    description: z.string().trim().max(400).optional(),
    iconUrl: z.string().url().optional(),
    programmingUrl: z.string().url().optional(),
    streamUrl: z.string().url().optional(),
  })
  .refine((b) => b.presetId != null || b.name != null, {
    message: 'Either presetId or name is required',
  })
export type AddInternetRadioStationInput = z.infer<typeof AddInternetRadioStationSchema>

export const PatchInternetRadioStationSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    genre: z.string().trim().max(40).nullable().optional(),
    description: z.string().trim().max(400).nullable().optional(),
    iconUrl: z.string().url().nullable().optional(),
    programmingUrl: z.string().url().nullable().optional(),
    streamUrl: z.string().url().nullable().optional(),
    position: z.number().int().min(0).max(999).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'No fields to update' })
export type PatchInternetRadioStationInput = z.infer<typeof PatchInternetRadioStationSchema>
