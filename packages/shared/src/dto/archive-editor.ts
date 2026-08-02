// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const ArchiveEditorSourceSchema = z.object({
  url: z.string().url(),
  durationSec: z.number().int().nullable(),
  title: z.string(),
  sourceKey: z.string(),
  /** Source blob size for browser vs server render routing. */
  sourceFileSizeBytes: z.number().int().nonnegative().nullable(),
})

export const LufsTargetSchema = z.enum(['none', 'stream', 'club'])
export type LufsTarget = z.infer<typeof LufsTargetSchema>

/** PLAT-066/068: 3-band shelving/peaking EQ, ±12dB per band. */
export const EqBandsSchema = z.object({
  lowGainDb: z.number().finite().min(-12).max(12).default(0),
  midGainDb: z.number().finite().min(-12).max(12).default(0),
  highGainDb: z.number().finite().min(-12).max(12).default(0),
})
export type EqBands = z.infer<typeof EqBandsSchema>

export const ArchiveEditorBounceSchema = z.object({
  startSec: z.number().finite().min(0),
  endSec: z.number().finite().positive(),
  fadeInSec: z.number().finite().min(0).max(30).default(0),
  fadeOutSec: z.number().finite().min(0).max(30).default(0),
  peakNormalize: z.boolean().default(false),
  lufsTarget: LufsTargetSchema.default('none'),
  limiterEnabled: z.boolean().default(false),
  // PLAT-066/067: HP/LP filters, 0 = disabled
  highPassHz: z.number().finite().min(0).max(2000).default(0),
  lowPassHz: z.number().finite().min(0).max(20000).default(0),
  eq: EqBandsSchema.default({ lowGainDb: 0, midGainDb: 0, highGainDb: 0 }),
  compressorEnabled: z.boolean().default(false),
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

// PLAT-069: bounce a READY archive version into a release track
export const ArchiveEditorPublishSchema = z.object({
  releaseId: z.string().min(1),
  versionId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(200).optional(),
})

export const ArchiveEditorPublishResponseSchema = z.object({
  ok: z.literal(true),
  trackId: z.string(),
  status: z.string(),
})

export type ArchiveEditorPublishInput = z.infer<typeof ArchiveEditorPublishSchema>

/** Max length for clips cut from archive tracks in the pro editor. */
export const ARCHIVE_CLIP_MAX_DURATION_SEC = 60

/** Create a station-ID / announcement clip from an in/out selection on an archive track. */
export const ArchiveEditorCreateClipSchema = z
  .object({
    startSec: z.number().finite().min(0),
    endSec: z.number().finite().min(0),
    title: z.string().trim().min(1).max(120).optional(),
    fadeInSec: z.number().finite().min(0).max(5).default(0.25),
    fadeOutSec: z.number().finite().min(0).max(5).default(0.25),
  })
  .refine((b) => b.endSec > b.startSec, { message: 'End must be after start' })
  .refine((b) => b.endSec - b.startSec <= ARCHIVE_CLIP_MAX_DURATION_SEC, {
    message: `Clip must be ${ARCHIVE_CLIP_MAX_DURATION_SEC} seconds or less`,
  })
export type ArchiveEditorCreateClipInput = z.infer<typeof ArchiveEditorCreateClipSchema>

export const ArchiveEditorCreateClipResponseSchema = z.object({
  ok: z.literal(true),
  clipId: z.string(),
  title: z.string(),
  durationSec: z.number(),
  renderStatus: z.enum(['READY', 'PROCESSING', 'ERROR']),
})
