// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const StreamSettingsResponseSchema = z.object({
  rtmp: z.object({
    server: z.string(),
    streamKey: z.string(),
    /** STREAM-003: alternate RTMP servers when primary ingest is unreachable. */
    fallbackServers: z.array(z.string()).optional(),
  }),
  icecast: z.object({
    server: z.string(),
    mount: z.string(),
    password: z.string(),
    hint: z.string(),
    fallbackServers: z.array(z.string()).optional(),
  }),
  hlsUrl: z.string(),
})

export const StreamKeyRotateResponseSchema = z.object({
  rtmpStreamKey: z.string(),
})

export const ObsPresetResponseSchema = z.object({
  server: z.string(),
  streamKey: z.string(),
  recommended: z.object({
    audioCodec: z.string(),
    audioBitrateKbps: z.number(),
    sampleRateHz: z.number(),
    channels: z.string(),
    videoCodec: z.string(),
    videoBitrateKbps: z.number(),
    keyframeIntervalSec: z.number(),
    preset: z.string(),
    profile: z.string(),
    tune: z.string(),
  }),
  /** Real OBS scene-collection JSON (Scene Collection → Import) with cover art + title
   * pre-wired — a local-OBS convenience only; does not affect Tahti's own ingest or
   * the YouTube/Twitch multistream mirror (which bakes its own video track server-side). */
  sceneCollection: z.record(z.string(), z.unknown()),
  sceneCollectionFilename: z.string(),
})

export const StreamSignalStatusResponseSchema = z.object({
  connected: z.boolean(),
  codec: z.string().nullable(),
  bitrateKbps: z.number().nullable(),
  listeners: z.number().nullable(),
})

export const IcecastPassRotateResponseSchema = z.object({
  liveSourcePass: z.string(),
})

export const RtmpTargetViewSchema = z.object({
  id: z.string(),
  provider: z.string(),
  label: z.string(),
  rtmpUrl: z.string(),
  alwaysMirror: z.boolean(),
  enabled: z.boolean(),
  createdAt: z.coerce.date().optional(),
  /** Last 4 characters of the stream key — for "key ••••••{last4}" display. Full key is never listed. */
  keyLast4: z.string().optional(),
})

export const RtmpTargetListSchema = z.array(RtmpTargetViewSchema)

export const RtmpStreamKeyRevealSchema = z.object({
  streamKey: z.string(),
})

/** Manage tab multistream status row — 'disabled' means the target exists but
 * is toggled off; 'offline' means enabled but the channel isn't currently
 * running Liquidsoap at all; 'connected'/'error' come from a live docker-logs
 * scan (see getRtmpTargetStatuses in the orchestrator). */
export const RtmpTargetStatusSchema = z.enum(['connected', 'error', 'offline', 'disabled'])

export const RtmpTargetStatusViewSchema = z.object({
  id: z.string(),
  provider: z.string(),
  label: z.string(),
  enabled: z.boolean(),
  status: RtmpTargetStatusSchema,
  lastError: z.string().optional(),
})

export const RtmpTargetStatusListSchema = z.array(RtmpTargetStatusViewSchema)
