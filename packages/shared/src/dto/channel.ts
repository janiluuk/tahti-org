// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const ChannelSlugSchema = z
  .string()
  .min(2, 'Channel slug must be at least 2 characters')
  .max(48, 'Channel slug too long')
  .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens')

export const UpdateChannelSchema = z.object({
  customDomain: z.string().optional().nullable(),
})

export type UpdateChannelInput = z.infer<typeof UpdateChannelSchema>
