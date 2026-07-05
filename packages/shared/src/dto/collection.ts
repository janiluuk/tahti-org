// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const COLLECTION_TYPES = ['MIX_SERIES', 'ALBUM', 'CUSTOM'] as const

export const COLLECTION_STYLES = [
  'ALBUM',
  'EP',
  'SINGLE',
  'DJ_SET_SERIES',
  'LIVE_ARCHIVE',
  'COMPILATION',
  'PLAYLIST',
] as const

export const CreateCollectionSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(100),
  slug: z.string().min(2).max(64).optional(),
  description: z.string().max(1000).optional(),
  type: z.enum(COLLECTION_TYPES).optional(),
  style: z.enum(COLLECTION_STYLES).optional(),
  isPublic: z.boolean().optional(),
  coverUrl: z.string().max(500).optional(),
})

export type CreateCollectionInput = z.infer<typeof CreateCollectionSchema>

export const PatchCollectionSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().max(1000).nullable().optional(),
    style: z.enum(COLLECTION_STYLES).optional(),
    isPublic: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    coverUrl: z.string().max(500).nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'No fields to update' })

export type PatchCollectionInput = z.infer<typeof PatchCollectionSchema>

export const AddCollectionItemSchema = z
  .object({
    archiveItemId: z.string().min(1).optional(),
    releaseId: z.string().min(1).optional(),
    position: z.number().int().min(1).optional(),
  })
  .refine((b) => Boolean(b.archiveItemId) !== Boolean(b.releaseId), {
    message: 'Provide archiveItemId or releaseId, not both',
  })

export type AddCollectionItemInput = z.infer<typeof AddCollectionItemSchema>

export const ReorderCollectionSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1, 'itemIds array is required'),
})

export type ReorderCollectionInput = z.infer<typeof ReorderCollectionSchema>

export const ReorderCollectionProfileSchema = z.object({
  slugs: z.array(z.string().min(1)).min(1, 'slugs array is required'),
})

export type ReorderCollectionProfileInput = z.infer<typeof ReorderCollectionProfileSchema>
