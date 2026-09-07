// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { VISUAL_PRESETS } from './visual-preset.js'

export const RtmpProviderSchema = z.enum([
  'YOUTUBE',
  'TWITCH',
  'FACEBOOK',
  'KICK',
  'TIKTOK',
  'MIXCLOUD_LIVE',
  'INSTAGRAM',
  'CUSTOM',
])

export type RtmpProvider = z.infer<typeof RtmpProviderSchema>

export const CreateRtmpTargetSchema = z.object({
  provider: z
    .string()
    .optional()
    .transform((v) => (v ?? 'CUSTOM').toUpperCase())
    .pipe(RtmpProviderSchema),
  label: z.string().trim().min(1, 'label is required').max(64),
  streamKey: z.string().trim().min(1, 'streamKey is required'),
  rtmpUrl: z.string().trim().optional(),
  alwaysMirror: z.boolean().optional(),
})

export type CreateRtmpTargetInput = z.infer<typeof CreateRtmpTargetSchema>

export const PatchRtmpTargetSchema = z.object({
  enabled: z.boolean().optional(),
  streamKey: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1).max(64).optional(),
})

export type PatchRtmpTargetInput = z.infer<typeof PatchRtmpTargetSchema>

/** A raw TCP reachability check against the target's ingest host:port —
 * confirms the endpoint accepts connections, not that the stream key
 * itself is valid (that would need an actual RTMP handshake per
 * platform, which isn't implemented). */
export const RtmpTargetTestResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
})

export type RtmpTargetTestResult = z.infer<typeof RtmpTargetTestResultSchema>

/** The video overlay baked into every multistream mirror push (see
 * buildRtmpMirrorOutput) — shared across all of a channel's RTMP targets,
 * not per-target. Empty string clears back to the display-name/avatar
 * fallback. */
export const ChannelStreamOverlayPatchSchema = z.object({
  streamOverlayTitle: z.string().trim().max(80).optional(),
  streamOverlaySubtitle: z.string().trim().max(120).optional(),
  streamOverlayCoverUrl: z.union([z.string().trim().url(), z.literal('')]).optional(),
  streamOverlayBackdropUrl: z.union([z.string().trim().url(), z.literal('')]).optional(),
  streamOverlayVisualPreset: z.enum(VISUAL_PRESETS).optional(),
})

export type ChannelStreamOverlayPatchInput = z.infer<typeof ChannelStreamOverlayPatchSchema>
