// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const EgressDailyPointSchema = z.object({
  date: z.string(),
  bytes: z.number().int().nonnegative(),
  downloads: z.number().int().nonnegative(),
})

export const ChannelEgressResponseSchema = z.object({
  windowDays: z.number().int().min(1),
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

export const LiveDailyPointSchema = z.object({
  date: z.string(),
  liveSeconds: z.number().int().nonnegative(),
  broadcastCount: z.number().int().nonnegative(),
})

export const ChannelLiveStatsResponseSchema = z.object({
  windowDays: z.number().int().min(1),
  totalLiveSeconds: z.number().int().nonnegative(),
  totalBroadcasts: z.number().int().nonnegative(),
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

export const ChannelFunnelResponseSchema = z.object({
  downloadGates: DownloadGateStatsResponseSchema,
  live: ChannelLiveStatsResponseSchema,
  egress: ChannelEgressResponseSchema,
})

export const ChannelScheduleViewSchema = z.object({
  nextBroadcastAt: z.string().datetime().nullable(),
  nextBroadcastNote: z.string().nullable(),
})

export const DownloadUrlResponseSchema = z.object({
  url: z.string().url(),
  counted: z.boolean(),
})

export const DownloadGateStatusSchema = z.object({
  repostRequired: z.boolean(),
  followRequired: z.boolean(),
  repostSatisfied: z.boolean(),
  followSatisfied: z.boolean(),
  canDownload: z.boolean(),
})

export type DownloadGateStatus = z.infer<typeof DownloadGateStatusSchema>

export const TransparencyYtdResponseSchema = z.object({
  year: z.string(),
  byCategory: z.record(z.string()),
  runningSurplus: z.string(),
  monthsFinalized: z.number().int().nonnegative(),
})

export const TransparencyGrantReportSchema = z.object({
  year: z.number().int(),
  totalCents: z.string(),
  grantCount: z.number().int().nonnegative(),
  grants: z.array(
    z.object({
      publishedAs: z.string(),
      units: z.number(),
      amountCents: z.string(),
      state: z.string(),
    }),
  ),
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

export const ArtistFollowResponseSchema = z.object({
  following: z.boolean(),
})

export const TransparencyMonthlyRollupSchema = z.object({
  yearMonth: z.string(),
  byCategory: z.record(z.unknown()),
  surplus: z.string(),
  finalizedAt: z.string().datetime().nullable(),
})

export const TransparencyMonthlyRollupListSchema = z.array(TransparencyMonthlyRollupSchema)

export const TransparencyCategoriesResponseSchema = z.object({
  revenue: z.array(z.object({ code: z.string(), label: z.string() })),
  costs: z.array(z.object({ code: z.string(), label: z.string() })),
  disbursements: z.array(z.object({ code: z.string(), label: z.string() })),
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
