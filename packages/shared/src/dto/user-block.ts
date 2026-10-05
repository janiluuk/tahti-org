// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const BlockUserSchema = z.object({
  username: z.string().trim().min(1).max(64),
})

export const BlockedUserSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  blockedAt: z.coerce.date(),
})
export type BlockedUser = z.infer<typeof BlockedUserSchema>

export const BlockedUserListSchema = z.object({
  blocked: z.array(BlockedUserSchema),
})
