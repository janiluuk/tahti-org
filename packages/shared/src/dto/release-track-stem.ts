// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const RELEASE_TRACK_STEM_ROLES = ['vocals', 'drums', 'bass', 'other'] as const
export const RELEASE_STEM_ROLES = RELEASE_TRACK_STEM_ROLES
export const ReleaseTrackStemRoleSchema = z.enum(RELEASE_TRACK_STEM_ROLES)
export type ReleaseTrackStemRole = z.infer<typeof ReleaseTrackStemRoleSchema>

export const RELEASE_TRACK_STEM_ROLE_LABELS: Record<ReleaseTrackStemRole, string> = {
  vocals: 'Vocals',
  drums: 'Drums',
  bass: 'Bass',
  other: 'Other',
}
export const RELEASE_STEM_ROLE_LABELS = RELEASE_TRACK_STEM_ROLE_LABELS

export const ReleaseTrackStemPrepareSchema = z.object({
  role: ReleaseTrackStemRoleSchema,
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128),
})

export type ReleaseTrackStemPrepare = z.infer<typeof ReleaseTrackStemPrepareSchema>

export const ReleaseTrackStemCompleteSchema = z.object({
  role: ReleaseTrackStemRoleSchema,
  uploadId: z.string().min(1).max(512),
  durationSec: z
    .number()
    .int()
    .positive()
    .max(60 * 60 * 12)
    .optional(),
})

export type ReleaseTrackStemComplete = z.infer<typeof ReleaseTrackStemCompleteSchema>

export const ReleaseTrackStemViewSchema = z.object({
  id: z.string(),
  role: ReleaseTrackStemRoleSchema,
  status: z.string(),
  durationSec: z.number().int().nullable(),
  audioUrl: z.string().url().nullable(),
  createdAt: z.string(),
})

export type ReleaseTrackStemView = z.infer<typeof ReleaseTrackStemViewSchema>

export const ReleaseTrackStemListSchema = z.array(ReleaseTrackStemViewSchema)

export const ReleaseTrackStemPrepareResponseSchema = z.object({
  uploadId: z.string(),
  uploadUrl: z.string().url(),
  expiresAt: z.string(),
  role: ReleaseTrackStemRoleSchema,
})

export const ReleaseTrackStemPublicSchema = z.object({
  id: z.string(),
  role: ReleaseTrackStemRoleSchema,
  durationSec: z.number().int().nullable(),
  audioUrl: z.string().url().nullable(),
  playUrl: z.string().url().nullable(),
})
