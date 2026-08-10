// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { AvatarThemeSchema, LogoPlacementSchema } from './avatar-theme.js'

export const ARTIST_KINDS = ['SINGLE', 'COLLECTIVE'] as const
export type ArtistKind = (typeof ARTIST_KINDS)[number]

export const ProfilePatchSchema = z
  .object({
    displayName: z.string().trim().min(1, 'displayName cannot be empty').max(100).optional(),
    bio: z.string().max(5000).optional(),
    avatarUrl: z.string().trim().max(2000).optional(),
    avatarPosterUrl: z.string().trim().max(2000).nullable().optional(),
    /** Solid / gradient avatar fill. Null clears a stored theme (falls back to seeded default). */
    avatarTheme: AvatarThemeSchema.nullable().optional(),
    /** Alpha PNG/WebP logo URL. Null clears the logo. */
    logoUrl: z.string().trim().max(2000).nullable().optional(),
    logoPlacement: LogoPlacementSchema.nullable().optional(),
    tipJarUrl: z.string().trim().max(2000).optional(),
    countryCode: z.string().length(2).toUpperCase().nullable().optional(),
    pronouns: z.string().trim().max(40).nullable().optional(),
    defaultLocation: z.string().trim().max(120).nullable().optional(),
    socialLinks: z.record(z.string()).optional(),
    publicAttribution: z.boolean().optional(),
    showJoinDate: z.boolean().optional(),
    showFollowers: z.boolean().optional(),
    showFollowing: z.boolean().optional(),
    showDailyListeners: z.boolean().optional(),
    /** Solo DJ/artist vs collective/band. */
    artistKind: z.enum(ARTIST_KINDS).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' })

export type ProfilePatchInput = z.infer<typeof ProfilePatchSchema>

export const MetaStreamOptSchema = z.object({
  optOut: z.boolean({ required_error: 'optOut (boolean) is required' }),
})

export const MentionsEnabledSchema = z
  .object({
    mentionsEnabled: z.boolean().optional(),
    publicMentionsEnabled: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' })
