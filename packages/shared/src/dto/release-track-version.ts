// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const ReleaseTrackVersionPrepareSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128),
})

export const ReleaseTrackVersionCompleteSchema = z.object({
  uploadId: z.string().min(1).max(512),
  versionLabel: z.string().min(1).max(120),
})

export type ReleaseTrackVersionPrepare = z.infer<typeof ReleaseTrackVersionPrepareSchema>
export type ReleaseTrackVersionComplete = z.infer<typeof ReleaseTrackVersionCompleteSchema>

export interface ReleaseTrackVersionRow {
  id: string
  versionNumber: number
  versionLabel: string
  status: string
  isActive: boolean
  durationSec: number | null
  createdAt: string
}
