// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { TracklistEntrySchema } from './archive-metadata.js'

export const BroadcastIdParamSchema = z.object({
  broadcastId: z.string().min(1),
})

/** STREAM-008: chromaprint segment posted from ingest sidecar. */
export const BroadcastFingerprintSegmentBodySchema = z.object({
  offsetSec: z.number().int().nonnegative(),
  durationSec: z.number().int().min(1).max(120).optional(),
  fingerprint: z.string().min(8).max(8192),
  /** Optional compact MP3 sample (base64) for ACRCloud identify at ingest. */
  audioSampleBase64: z.string().max(512_000).optional(),
})

export const LiveFingerprintSegmentSchema = z.object({
  offsetSec: z.number().int().nonnegative(),
  durationSec: z.number().int().min(1).max(120),
  fingerprint: z.string().min(8).max(8192),
  capturedAt: z.string().datetime(),
  title: z.string().min(1).max(200).optional(),
  artist: z.string().max(120).optional(),
  identifySource: z.enum(['acrcloud', 'acoustid']).optional(),
})

export const LiveFingerprintsResponseSchema = z.object({
  broadcastId: z.string(),
  segments: z.array(LiveFingerprintSegmentSchema),
  /** Collapsed track-boundary hints (AcoustID titles when configured). */
  tracklist: z.array(TracklistEntrySchema).optional(),
})

export type LiveFingerprintSegment = z.infer<typeof LiveFingerprintSegmentSchema>
export type LiveFingerprintsResponse = z.infer<typeof LiveFingerprintsResponseSchema>
