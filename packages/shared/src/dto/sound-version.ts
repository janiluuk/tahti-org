// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const SoundVersionPrepareSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128),
})

export const SoundVersionCompleteSchema = z.object({
  uploadId: z.string().min(1).max(512),
  versionLabel: z.string().min(1).max(120),
  fileSizeBytes: z.number().int().nonnegative().optional(),
})

export type SoundVersionPrepare = z.infer<typeof SoundVersionPrepareSchema>
export type SoundVersionComplete = z.infer<typeof SoundVersionCompleteSchema>

export const SoundVersionViewSchema = z.object({
  id: z.string(),
  versionNumber: z.number().int(),
  versionLabel: z.string(),
  status: z.string(),
  isActive: z.boolean(),
  durationSec: z.number().int().nullable(),
  sourceFormat: z.string().nullable(),
  sourceBitrateKbps: z.number().int().nullable(),
  createdAt: z.string(),
})

export const SoundVersionListSchema = z.array(SoundVersionViewSchema)

export const SoundVersionPrepareResponseSchema = z.object({
  uploadId: z.string(),
  uploadUrl: z.string().url(),
  expiresAt: z.string(),
})

export const SoundVersionCreatedSchema = z.object({
  versionId: z.string(),
  versionNumber: z.number().int(),
  versionLabel: z.string(),
  status: z.string(),
})

export interface SoundVersionRow {
  id: string
  versionNumber: number
  versionLabel: string
  status: string
  isActive: boolean
  durationSec: number | null
  sourceFormat: string | null
  sourceBitrateKbps: number | null
  sourceSampleRateHz: number | null
  sourceBitDepth: number | null
  sourceChannels: number | null
  createdAt: string
}
