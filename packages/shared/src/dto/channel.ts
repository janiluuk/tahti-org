// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** Shared with User.username on rename — keep ≤32 so @handle and slug.tahti.live stay aligned. */
export const ChannelSlugSchema = z
  .string()
  .min(2, 'Channel slug must be at least 2 characters')
  .max(32, 'Channel slug too long')
  .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens')

export const UpdateChannelSchema = z.object({
  customDomain: z.string().optional().nullable(),
})

export type UpdateChannelInput = z.infer<typeof UpdateChannelSchema>

/** Top-level Next.js route segments under apps/web/src/app, plus platform
 * infra hostnames (Caddy / tls-ask) and curated channels — none of these can
 * become someone's <slug>.tahti.live. */
export const RESERVED_CHANNEL_SLUGS = [
  'admin',
  'api',
  'app',
  'apply',
  'auth',
  'c',
  'cdn',
  'chat',
  'dashboard',
  'dev',
  'embed',
  'feed',
  'governance',
  'grafana',
  'help',
  'ingest',
  'ingest-b',
  'ingest-icecast',
  'ingest-icecast-b',
  'join',
  'listen',
  'login',
  'mail',
  'minio',
  'r',
  'radio',
  'registry',
  'setup-password',
  'signup',
  'status',
  'stream',
  'support',
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
  reason: z.enum(['taken', 'reserved', 'recently_released']).optional(),
})

export const ChannelSlugUpdateSchema = z.object({
  slug: ChannelSlugSchema,
})

export const ChannelSlugUpdateResponseSchema = z.object({
  slug: z.string(),
  rtmpStreamKey: z.string(),
  /** The previous address now redirects here until this date — see
   * ChannelSlugRedirect. Null on a channel's very first slug set. */
  previousSlugRedirectExpiresAt: z.string().nullable(),
})

/** GET /api/channels/:slug/redirect — resolves an old, renamed-away slug to
 * its channel's current slug, while the 30-day grace redirect is still active. */
export const ChannelSlugRedirectResponseSchema = z.object({
  slug: z.string(),
})
