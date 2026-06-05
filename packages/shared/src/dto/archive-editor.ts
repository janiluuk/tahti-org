// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const ArchiveEditorSourceSchema = z.object({
  url: z.string().url(),
  durationSec: z.number().int().nullable(),
  title: z.string(),
  sourceKey: z.string(),
})

export const LufsTargetSchema = z.enum(['none', 'stream', 'club'])
export type LufsTarget = z.infer<typeof LufsTargetSchema>

export const ArchiveEditorBounceSchema = z.object({
  startSec: z.number().min(0),
  endSec: z.number().positive(),
  fadeInSec: z.number().min(0).max(30).default(0),
  fadeOutSec: z.number().min(0).max(30).default(0),
  peakNormalize: z.boolean().default(false),
  lufsTarget: LufsTargetSchema.default('none'),
  limiterEnabled: z.boolean().default(false),
  versionLabel: z.string().trim().min(1).max(120),
  activate: z.boolean().default(true),
})

export const ArchiveEditorBounceResponseSchema = z.object({
  ok: z.literal(true),
  versionId: z.string(),
  versionNumber: z.number().int(),
  status: z.string(),
})

export type ArchiveEditorBounceInput = z.infer<typeof ArchiveEditorBounceSchema>
