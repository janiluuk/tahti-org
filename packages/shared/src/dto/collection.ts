// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const COLLECTION_TYPES = ['MIX_SERIES', 'ALBUM', 'CUSTOM'] as const

export const COLLECTION_STYLES = [
  'ALBUM',
  'EP',
  'SINGLE',
  'DJ_SET_SERIES',
  'PODCAST',
  'RECORDING',
  'PLAYLIST',
] as const

/** MANUAL respects drag-reordered position; TIME/NAME are computed at display time. */
export const COLLECTION_TRACK_SORT_MODES = ['MANUAL', 'TIME', 'NAME'] as const

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
    trackSortMode: z.enum(COLLECTION_TRACK_SORT_MODES).optional(),
    isPublic: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    collaborative: z.boolean().optional(),
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

/** Body for a non-owner adding a track to a collaborative playlist — archive
 * items only (any public, READY track in the catalog), always appended at
 * the end. Distinct from AddCollectionItemSchema (the owner's own route,
 * which also accepts releases and an explicit insert position). */
export const AddCollaborativeTrackSchema = z.object({
  archiveItemId: z.string().min(1),
  /** Optional short note from the contributor about why they added this track. */
  note: z.string().trim().max(200).optional(),
})

export type AddCollaborativeTrackInput = z.infer<typeof AddCollaborativeTrackSchema>

export const CollectionSubscriptionResponseSchema = z.object({
  subscribed: z.boolean(),
  subscriberCount: z.number().int(),
})

export const CatalogTrackSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

export const ReorderCollectionSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1, 'itemIds array is required'),
})

export type ReorderCollectionInput = z.infer<typeof ReorderCollectionSchema>

export const ReorderCollectionProfileSchema = z.object({
  slugs: z.array(z.string().min(1)).min(1, 'slugs array is required'),
})

export type ReorderCollectionProfileInput = z.infer<typeof ReorderCollectionProfileSchema>
