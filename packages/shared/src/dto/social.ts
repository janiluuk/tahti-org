// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const DEFAULT_SOCIAL_TEMPLATE = 'New release: {release} by {artist} — {smart_link}'

export const LIVE_SOCIAL_TEMPLATE = 'Live now on Tahti: {artist} — {channel_url}'

export const MastodonConnectSchema = z.object({
  instanceUrl: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .transform((s) => s.replace(/\/+$/, '')),
  accessToken: z.string().trim().min(1).max(500).optional(),
  onReleasePublished: z.boolean().optional(),
  onChannelLive: z.boolean().optional(),
  postTemplate: z.string().trim().min(1).max(500).optional(),
})

export const SocialManualPostSchema = z.object({
  message: z.string().trim().min(1).max(500),
})

export const SocialConnectionViewSchema = z.object({
  platform: z.literal('MASTODON'),
  connected: z.boolean(),
  instanceUrl: z.string().nullable(),
  onReleasePublished: z.boolean(),
  onChannelLive: z.boolean(),
  postTemplate: z.string(),
})

export const SocialPostLogSchema = z.object({
  id: z.string(),
  trigger: z.string(),
  state: z.enum(['PENDING', 'SENT', 'FAILED']),
  message: z.string(),
  externalId: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.coerce.date(),
  sentAt: z.coerce.date().nullable(),
})

export type MastodonConnectInput = z.infer<typeof MastodonConnectSchema>
