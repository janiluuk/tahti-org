// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const SoundShareViewSchema = z.object({
  id: z.string(),
  granteeUsername: z.string().nullable(),
  token: z.string(),
  permission: z.string(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
})

export const SoundShareListSchema = z.object({
  shares: z.array(SoundShareViewSchema),
})

export type SoundShareView = z.infer<typeof SoundShareViewSchema>
export type SoundShareList = z.infer<typeof SoundShareListSchema>
