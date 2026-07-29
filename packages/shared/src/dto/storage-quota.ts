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
