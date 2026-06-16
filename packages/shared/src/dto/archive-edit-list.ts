// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { EditListSchema } from '@tahti/audio-edit'
import { TracklistEntrySchema } from './archive-metadata.js'

export { EditListSchema }
export type { EditList } from '@tahti/audio-edit'
export { createDefaultEditList } from '@tahti/audio-edit'

export const ArchiveEditListDraftResponseSchema = z.object({
  editList: EditListSchema,
  updatedAt: z.string().datetime().nullable(),
  tracklist: z.array(TracklistEntrySchema).max(200).nullable().optional(),
})

/** Defense in depth against pathological autosave payloads (500 cuts × metadata). */
export const MAX_EDIT_LIST_JSON_BYTES = 128_000

export const ArchiveEditListDraftPatchSchema = z
  .object({
    editList: EditListSchema,
    /** UX-09: reject save when another tab/device saved a newer draft. */
    expectedUpdatedAt: z.string().datetime().optional(),
  })
  .refine((body) => JSON.stringify(body).length <= MAX_EDIT_LIST_JSON_BYTES, {
    message: `editList payload exceeds ${MAX_EDIT_LIST_JSON_BYTES} bytes`,
  })

export const ArchiveEditListDraftPatchResponseSchema = z.object({
  ok: z.literal(true),
  updatedAt: z.string().datetime(),
})

export const ArchiveEditListRenderSchema = z.object({
  editList: EditListSchema,
  versionLabel: z.string().trim().min(1).max(120),
  activate: z.boolean().default(true),
  format: z.enum(['flac', 'mp3']).default('flac'),
})

export const ArchiveEditListRenderResponseSchema = z.object({
  ok: z.literal(true),
  versionId: z.string(),
  versionNumber: z.number().int(),
  status: z.string(),
})
