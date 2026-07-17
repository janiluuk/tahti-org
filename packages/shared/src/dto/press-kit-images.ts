// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const PressKitImagePrepareSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().regex(/^image\//),
})
export type PressKitImagePrepareInput = z.infer<typeof PressKitImagePrepareSchema>

export const PressKitImagePrepareResponseSchema = z.object({
  uploadKey: z.string(),
  uploadUrl: z.string(),
  expiresAt: z.string(),
})

export const PressKitImageCompleteSchema = z.object({
  uploadKey: z.string().min(1),
  title: z.string().trim().max(120).optional(),
})
export type PressKitImageCompleteInput = z.infer<typeof PressKitImageCompleteSchema>

export const PressKitImageItemSchema = z.object({
  id: z.string(),
  imageUrl: z.string(),
  title: z.string().nullable(),
  position: z.number().int(),
  includeInZip: z.boolean(),
})
export type PressKitImageItem = z.infer<typeof PressKitImageItemSchema>

export const PressKitImageListSchema = z.array(PressKitImageItemSchema)

export const PressKitImagePatchSchema = z
  .object({
    title: z.string().trim().max(120).nullable().optional(),
    includeInZip: z.boolean().optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' })
export type PressKitImagePatchInput = z.infer<typeof PressKitImagePatchSchema>

export const PressKitGallerySettingsPatchSchema = z.object({
  pressKitGalleryPublic: z.boolean(),
})
export type PressKitGallerySettingsPatchInput = z.infer<typeof PressKitGallerySettingsPatchSchema>

export const PressKitGallerySettingsResponseSchema = z.object({
  pressKitGalleryPublic: z.boolean(),
})

/** Public gallery view — same shape as the dashboard list, minus the zip-inclusion flag. */
export const PublicPressKitImageSchema = z.object({
  id: z.string(),
  imageUrl: z.string(),
  title: z.string().nullable(),
})
export type PublicPressKitImage = z.infer<typeof PublicPressKitImageSchema>
export const PublicPressKitImageListSchema = z.array(PublicPressKitImageSchema)
