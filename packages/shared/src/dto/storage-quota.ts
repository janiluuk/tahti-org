// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const StorageQuotaViewSchema = z.object({
  quotaBytes: z.number(),
  usedBytes: z.number(),
})

export const AdminStorageUsageRowSchema = z.object({
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
  quotaBytes: z.number(),
  usedBytes: z.number(),
})

export const AdminStorageOverviewSchema = z.object({
  totalQuotaBytes: z.number(),
  totalUsedBytes: z.number(),
  userCount: z.number().int(),
  users: z.array(AdminStorageUsageRowSchema),
})

// Only release tracks write through to R2 so far (see task tracking in
// [[project-tahti]]) — the file browser is scoped to that content type until
// archive items/announcements/avatars get the same treatment.
export const AdminUserFileSchema = z.object({
  trackId: z.string(),
  title: z.string(),
  releaseTitle: z.string(),
  durationSec: z.number().int().nullable(),
  inR2: z.boolean(),
  sizeBytes: z.number().nullable(),
  previewUrl: z.string().url().nullable(),
})

export const AdminUserFilesResponseSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  files: z.array(AdminUserFileSchema),
})

// Admin per-user quota override — min 1 byte (not 0, which would just block
// every future upload rather than express "no extra allowance"), max 1TB as
// a sanity ceiling against fat-fingering a value in bytes.
export const AdminSetUserQuotaSchema = z.object({
  quotaBytes: z
    .number()
    .int()
    .min(1)
    .max(1024 * 1024 * 1024 * 1024),
})

export type AdminSetUserQuota = z.infer<typeof AdminSetUserQuotaSchema>
