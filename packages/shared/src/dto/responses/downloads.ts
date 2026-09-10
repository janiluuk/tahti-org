// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const EgressDailyPointSchema = z.object({
  date: z.string(),
  /** Combined download + live HLS bytes for the UTC day. */
  bytes: z.number().int().nonnegative(),
  downloadBytes: z.number().int().nonnegative(),
  /** Measured from Caddy edge logs; 0 when unavailable. */
  liveHlsBytes: z.number().int().nonnegative(),
  estimatedLiveBytes: z.number().int().nonnegative(),
  downloads: z.number().int().nonnegative(),
})

export const ChannelEgressResponseSchema = z.object({
  windowDays: z.number().int().min(1),
  /** downloadBytes + effective live HLS (measured when present, else estimate). */
  totalBytes: z.number().int().nonnegative(),
  downloadBytes: z.number().int().nonnegative(),
  liveHlsBytes: z.number().int().nonnegative(),
  estimatedLiveHlsBytes: z.number().int().nonnegative(),
  totalDownloads: z.number().int().nonnegative(),
  daily: z.array(EgressDailyPointSchema),
  liveEstimateNote: z.string(),
})

export const GateDailyPointSchema = z.object({
  date: z.string(),
  repostAcks: z.number().int().nonnegative(),
  blockedAttempts: z.number().int().nonnegative(),
  countedDownloads: z.number().int().nonnegative(),
})

export const DownloadGateItemStatsSchema = z.object({
  soundId: z.string(),
  title: z.string(),
  repostToDownload: z.boolean(),
  followToDownload: z.boolean(),
  repostAckCount: z.number().int().nonnegative(),
  blockedDownloadAttempts: z.number().int().nonnegative(),
  countedDownloadCount: z.number().int().nonnegative(),
})

export const LiveDailyPointSchema = z.object({
  date: z.string(),
  liveSeconds: z.number().int().nonnegative(),
  broadcastCount: z.number().int().nonnegative(),
  /** Distinct anonymized HLS listeners measured from Caddy access logs; 0 when unavailable. */
  listeners: z.number().int().nonnegative(),
})

export const ChannelLiveStatsResponseSchema = z.object({
  windowDays: z.number().int().min(1),
  totalLiveSeconds: z.number().int().nonnegative(),
  totalBroadcasts: z.number().int().nonnegative(),
  /** Best single-day distinct-listener count across the window. */
  peakDailyListeners: z.number().int().nonnegative(),
  daily: z.array(LiveDailyPointSchema),
})

export const DownloadGateStatsResponseSchema = z.object({
  artistFollowerCount: z.number().int().nonnegative(),
  items: z.array(DownloadGateItemStatsSchema),
  totals: z.object({
    repostAcks: z.number().int().nonnegative(),
    blockedAttempts: z.number().int().nonnegative(),
    countedDownloads: z.number().int().nonnegative(),
  }),
  daily: z.array(GateDailyPointSchema),
})

// PERF-006: egress was dropped from this bundle — it's only ever shown inside the
// overview's collapsed-by-default "Analytics detail" panel, never used for a KPI, yet
// building it means a live Caddy-log read on every dashboard visit. Fetch
// GET /api/me/channel-egress directly if/when that detail is needed.
export const ChannelFunnelResponseSchema = z.object({
  downloadGates: DownloadGateStatsResponseSchema,
  live: ChannelLiveStatsResponseSchema,
})

export const ChannelScheduleViewSchema = z.object({
  nextBroadcastAt: z.string().datetime().nullable(),
  nextBroadcastNote: z.string().nullable(),
})

export const DownloadUrlResponseSchema = z.object({
  url: z.string().url(),
  counted: z.boolean(),
  format: z.string().optional(),
})

export const DownloadGateStatusSchema = z.object({
  repostRequired: z.boolean(),
  followRequired: z.boolean(),
  repostSatisfied: z.boolean(),
  followSatisfied: z.boolean(),
  canDownload: z.boolean(),
})

export type DownloadGateStatus = z.infer<typeof DownloadGateStatusSchema>

export const DownloadGateItemDetailResponseSchema = z.object({
  repostToDownload: z.boolean(),
  followToDownload: z.boolean(),
  artistFollowerCount: z.number().int().nonnegative(),
  repostAckCount: z.number().int().nonnegative(),
  blockedDownloadAttempts: z.number().int().nonnegative(),
  countedDownloadCount: z.number().int().nonnegative(),
})

export const BroadcastUsageResponseSchema = z.object({
  tier: z.string(),
  unlimited: z.boolean(),
  weeklyCapSeconds: z.number().int(),
  graceSeconds: z.number().int(),
  secondsUsed: z.number().int(),
  secondsRemaining: z.number().int(),
  warnings: z.array(z.string()),
  warningLevel: z.enum(['none', '45m', '55m', 'grace', 'blocked']),
  inGrace: z.boolean(),
  atCap: z.boolean(),
  blocked: z.boolean(),
  showUpgradeCta: z.boolean(),
})
