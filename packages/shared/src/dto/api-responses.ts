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
