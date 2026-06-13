// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { EditListSchema } from '@tahti/audio-edit'

export { EditListSchema }
export type { EditList } from '@tahti/audio-edit'
export { createDefaultEditList } from '@tahti/audio-edit'

export const ArchiveEditListDraftResponseSchema = z.object({
  editList: EditListSchema,
  updatedAt: z.string().datetime().nullable(),
})

export const ArchiveEditListDraftPatchSchema = z.object({
  editList: EditListSchema,
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
