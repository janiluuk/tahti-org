// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const ArchiveVersionPrepareSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128),
})

export const ArchiveVersionCompleteSchema = z.object({
  uploadId: z.string().min(1).max(512),
  versionLabel: z.string().min(1).max(120),
  fileSizeBytes: z.number().int().nonnegative().optional(),
})

export type ArchiveVersionPrepare = z.infer<typeof ArchiveVersionPrepareSchema>
export type ArchiveVersionComplete = z.infer<typeof ArchiveVersionCompleteSchema>

export interface ArchiveVersionRow {
  id: string
  versionNumber: number
  versionLabel: string
  status: string
  isActive: boolean
  durationSec: number | null
  createdAt: string
}
