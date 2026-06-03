// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const EgressDailyPointSchema = z.object({
  date: z.string(),
  bytes: z.number().int().nonnegative(),
  downloads: z.number().int().nonnegative(),
})

export const ChannelEgressResponseSchema = z.object({
  windowDays: z.number().int().positive(),
  totalBytes: z.number().int().nonnegative(),
  totalDownloads: z.number().int().nonnegative(),
  daily: z.array(EgressDailyPointSchema),
})

export const GateDailyPointSchema = z.object({
  date: z.string(),
  repostAcks: z.number().int().nonnegative(),
  blockedAttempts: z.number().int().nonnegative(),
  countedDownloads: z.number().int().nonnegative(),
})

export const DownloadGateItemStatsSchema = z.object({
  archiveItemId: z.string(),
  title: z.string(),
  repostToDownload: z.boolean(),
  followToDownload: z.boolean(),
  repostAckCount: z.number().int().nonnegative(),
  blockedDownloadAttempts: z.number().int().nonnegative(),
  countedDownloadCount: z.number().int().nonnegative(),
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

export const ChannelScheduleViewSchema = z.object({
  nextBroadcastAt: z.string().datetime().nullable(),
  nextBroadcastNote: z.string().nullable(),
})

export const DownloadGateItemDetailResponseSchema = z.object({
  repostToDownload: z.boolean(),
  followToDownload: z.boolean(),
  artistFollowerCount: z.number().int().nonnegative(),
  repostAckCount: z.number().int().nonnegative(),
  blockedDownloadAttempts: z.number().int().nonnegative(),
  countedDownloadCount: z.number().int().nonnegative(),
})

export const ApiStatusResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  version: z.string(),
  uptimeSec: z.number().int().nonnegative(),
  checks: z.record(
    z.object({
      state: z.string(),
      critical: z.boolean(),
      latencyMs: z.number().optional(),
      detail: z.string().optional(),
    }),
  ),
  ts: z.string().datetime(),
})

export const PublicChannelUserSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
})

export const PublicChannelViewSchema = z.object({
  slug: z.string(),
  state: z.string(),
  hlsUrl: z.string().nullable(),
  nextBroadcastAt: z.string().datetime().nullable(),
  nextBroadcastNote: z.string().nullable(),
  galleryMode: z.string(),
  slideshowImages: z.array(z.string()),
  textLayerMode: z.string(),
  textLayerText: z.string(),
  textLayerAlign: z.string(),
  videoBackgroundUrl: z.string().nullable(),
  user: PublicChannelUserSchema,
})

export const GrantAnomalySchema = z.object({
  code: z.enum(['DOMINANT_IP', 'HIGH_UNIT_SHARE', 'ANONYMOUS_GRANT']),
  message: z.string(),
})

export const GrantPreviewArtistSchema = z.object({
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
  publicAttribution: z.boolean(),
  units: z.number(),
  amountCents: z.number().int(),
  anomalies: z.array(GrantAnomalySchema),
})

export const GrantPreviewResponseSchema = z.object({
  forYear: z.number().int(),
  alreadyRun: z.boolean(),
  surplusCents: z.number().int(),
  reserveCents: z.number().int(),
  poolCents: z.number().int(),
  totalUnits: z.number(),
  grantCount: z.number().int(),
  unallocatedCents: z.number().int(),
  artists: z.array(GrantPreviewArtistSchema),
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
