// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const EditorProjectRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  archiveItemId: z.string().nullable(),
  updatedAt: z.string(),
})

export const EditorProjectListSchema = z.array(EditorProjectRowSchema)

export const EditorProjectCreateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  archiveItemId: z.string().optional(),
})

export const EditorProjectDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  archiveItemId: z.string().nullable(),
  timeline: z.record(z.unknown()),
  sources: z.array(
    z.object({
      archiveItemId: z.string(),
      title: z.string(),
      url: z.string().url(),
      durationSec: z.number().int().nullable(),
    }),
  ),
  updatedAt: z.string(),
})

export const EditorProjectUpdateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  timeline: z.record(z.unknown()).optional(),
})

export const EditorProjectExportSchema = z.object({
  archiveItemId: z.string(),
  versionLabel: z.string().trim().min(1).max(120),
  activate: z.boolean().default(true),
  uploadId: z.string(),
  fileSizeBytes: z.number().int().positive(),
})

export type EditorProjectRow = z.infer<typeof EditorProjectRowSchema>
