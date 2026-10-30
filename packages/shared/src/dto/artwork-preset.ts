// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const ArtworkPresetSchema = z.object({
  id: z.string(),
  /** Absolute image URL. */
  url: z.string(),
  enabled: z.boolean(),
  position: z.number().int(),
})
export type ArtworkPreset = z.infer<typeof ArtworkPresetSchema>

export const ArtworkPresetListSchema = z.object({
  presets: z.array(ArtworkPresetSchema),
})

export const CreateArtworkPresetSchema = z.object({
  url: z.string().trim().url().max(2048),
  enabled: z.boolean().optional(),
})
export type CreateArtworkPresetInput = z.infer<typeof CreateArtworkPresetSchema>

export const PatchArtworkPresetSchema = z
  .object({
    url: z.string().trim().url().max(2048).optional(),
    enabled: z.boolean().optional(),
    position: z.number().int().min(0).max(9999).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'No fields to update' })
export type PatchArtworkPresetInput = z.infer<typeof PatchArtworkPresetSchema>
