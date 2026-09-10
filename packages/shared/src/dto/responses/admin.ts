// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const AdminVenueBoardSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  city: z.string(),
  countryCode: z.string(),
  verifiedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  createdBy: z.string(),
})

export const AdminVenueListSchema = z.array(AdminVenueBoardSchema)

export const AdminVenueUpdatedSchema = AdminVenueBoardSchema.passthrough()

export const AdminMemberStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  newThisMonth: z.number().int().nonnegative(),
  lapsedThisMonth: z.number().int().nonnegative(),
})

export const AdminChatStatsSchema = z.object({
  last24h: z.number().int().nonnegative(),
})

export const AdminMailBoxStatsSchema = z.object({
  unseen: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
})

export const AdminMailStatsSchema = z.object({
  hello: AdminMailBoxStatsSchema,
  support: AdminMailBoxStatsSchema,
})

export const AdminChatTimeseriesPointSchema = z.object({
  date: z.string(),
  count: z.number().int().nonnegative(),
})

export const AdminChatTimeseriesSchema = z.object({
  // .min(1) rather than .positive() — zod-to-json-schema's openApi3 target
  // emits .positive() as a boolean-style `exclusiveMinimum: true`, which
  // Fastify's ajv rejects when compiling this as a response schema (ajv
  // wants exclusiveMinimum as a number). .min(1) has the same constraint
  // (integer >= 1) but serializes as a plain `minimum`.
  days: z.number().int().min(1),
  series: z.array(AdminChatTimeseriesPointSchema),
})

export const AdminQueueStatsSchema = z.object({
  name: z.string(),
  waiting: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  delayed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
})

export const AdminQueueStatsListSchema = z.array(AdminQueueStatsSchema)

export const AdminSystemHealthSchema = z.object({
  icecast: z.enum(['up', 'down']),
  minio: z.enum(['up', 'down']),
  discordBot: z.enum(['up', 'down']),
  postgresBackupAgeHours: z.number().nullable(),
  failedFanSubPayouts: z.number().int().nonnegative(),
})

export const AdminCronRunEntrySchema = z.object({
  id: z.string(),
  startedAt: z.coerce.date(),
  finishedAt: z.coerce.date().nullable(),
  outcome: z.string().nullable(),
  errorMessage: z.string().nullable(),
})

export const AdminCronJobStatusSchema = z.object({
  jobName: z.string(),
  description: z.string(),
  pattern: z.string(),
  lastRun: AdminCronRunEntrySchema.nullable(),
})

export const AdminCronRunListSchema = z.array(AdminCronJobStatusSchema)

export const AdminAuditRecentItemSchema = z.object({
  id: z.string(),
  action: z.string(),
  actorId: z.string(),
  targetId: z.string().nullable(),
  createdAt: z.coerce.date(),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const AdminAuditRecentListSchema = z.array(AdminAuditRecentItemSchema)

export const AdminLiveStreamSchema = z.object({
  channelId: z.string(),
  slug: z.string(),
  artistName: z.string(),
  username: z.string(),
  goneLiveAt: z.coerce.date().nullable(),
  elapsedSec: z.number().int().nonnegative(),
  hlsUrl: z.string().url().nullable(),
  /** True when this channel uses the curated-rotation Liquidsoap template. */
  isRotation: z.boolean(),
})

export const AdminLiveStreamListSchema = z.object({
  count: z.number().int().nonnegative(),
  streams: z.array(AdminLiveStreamSchema),
})

export const AdminUserListItemSchema = z.object({
  id: z.string(),
  memberNumber: z.number().int().nullable(),
  displayName: z.string(),
  email: z.string(),
  username: z.string(),
  tier: z.string(),
  isMember: z.boolean(),
  isBoard: z.boolean(),
  suspendedAt: z.coerce.date().nullable(),
  channelState: z.string().nullable(),
  memberSince: z.coerce.date().nullable(),
  engagementUnitsYtd: z.number().int().nonnegative(),
  /** R2 long-term storage usage (release track originals), rounded to whole MB. */
  storageUsedMB: z.number().nonnegative(),
})

export const AdminUserListResponseSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  users: z.array(AdminUserListItemSchema),
})

export const AdminUserDetailSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    username: z.string(),
    displayName: z.string(),
    tier: z.string(),
    isMember: z.boolean(),
    isBoard: z.boolean(),
    memberNumber: z.number().int().nullable(),
    memberSince: z.coerce.date().nullable(),
    suspendedAt: z.coerce.date().nullable(),
    suspendReason: z.string().nullable(),
    engagementUnitsYtd: z.number().int(),
    channel: z.unknown().nullable(),
    fanSubscriptionsAsArtist: z.number().int(),
    stripeConnectChargesEnabled: z.boolean(),
  })
  .passthrough()
