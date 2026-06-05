// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const BroadcastIdParamSchema = z.object({
  broadcastId: z.string().min(1),
})

/** STREAM-008: chromaprint segment posted from ingest sidecar. */
export const BroadcastFingerprintSegmentBodySchema = z.object({
  offsetSec: z.number().int().nonnegative(),
  durationSec: z.number().int().min(1).max(120).optional(),
  fingerprint: z.string().min(8).max(8192),
})

export const LiveFingerprintSegmentSchema = z.object({
  offsetSec: z.number().int().nonnegative(),
  durationSec: z.number().int().min(1).max(120),
  fingerprint: z.string().min(8).max(8192),
  capturedAt: z.string().datetime(),
})

export const LiveFingerprintsResponseSchema = z.object({
  broadcastId: z.string(),
  segments: z.array(LiveFingerprintSegmentSchema),
})

export type LiveFingerprintSegment = z.infer<typeof LiveFingerprintSegmentSchema>
export type LiveFingerprintsResponse = z.infer<typeof LiveFingerprintsResponseSchema>
