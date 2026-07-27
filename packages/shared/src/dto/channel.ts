// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

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

/** Top-level Next.js route segments under apps/web/src/app, plus the two
 * platform-curated channels — none of these can become someone's <slug>.tahti.live. */
export const RESERVED_CHANNEL_SLUGS = [
  'admin',
  'api',
  'apply',
  'auth',
  'c',
  'dashboard',
  'dev',
  'embed',
  'feed',
  'governance',
  'help',
  'join',
  'listen',
  'login',
  'r',
  'radio',
  'setup-password',
  'signup',
  'status',
  'tahti',
  'tahti-radio',
  'tahti-selects',
  'transparency',
  'u',
  'v',
  'venues',
  'verify',
  'www',
] as const

export const ChannelSlugAvailabilityQuerySchema = z.object({
  slug: ChannelSlugSchema,
})

export const ChannelSlugAvailabilityResponseSchema = z.object({
  available: z.boolean(),
  reason: z.enum(['taken', 'reserved']).optional(),
})

export const ChannelSlugUpdateSchema = z.object({
  slug: ChannelSlugSchema,
})

export const ChannelSlugUpdateResponseSchema = z.object({
  slug: z.string(),
  rtmpStreamKey: z.string(),
})
