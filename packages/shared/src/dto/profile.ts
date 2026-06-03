// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const ProfilePatchSchema = z
  .object({
    displayName: z.string().trim().min(1, 'displayName cannot be empty').max(100).optional(),
    bio: z.string().max(5000).optional(),
    avatarUrl: z.string().trim().max(2000).optional(),
    tipJarUrl: z.string().trim().max(2000).optional(),
    socialLinks: z.record(z.string()).optional(),
    publicAttribution: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' })

export type ProfilePatchInput = z.infer<typeof ProfilePatchSchema>

export const MetaStreamOptSchema = z.object({
  optOut: z.boolean({ required_error: 'optOut (boolean) is required' }),
})

export const MentionsEnabledSchema = z.object({
  mentionsEnabled: z.boolean({ required_error: 'mentionsEnabled (boolean) is required' }),
})
