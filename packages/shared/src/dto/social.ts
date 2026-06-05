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

export const BlueskyConnectSchema = z.object({
  handle: z.string().trim().min(3).max(200),
  appPassword: z.string().trim().min(1).max(500).optional(),
  onReleasePublished: z.boolean().optional(),
  onChannelLive: z.boolean().optional(),
  postTemplate: z.string().trim().min(1).max(300).optional(),
})

export const SocialManualPostSchema = z.object({
  message: z.string().trim().min(1).max(500),
  platform: z.enum(['MASTODON', 'BLUESKY', 'TWITTER']).default('MASTODON'),
})

export const TwitterSocialPatchSchema = z.object({
  onReleasePublished: z.boolean().optional(),
  onChannelLive: z.boolean().optional(),
  postTemplate: z.string().trim().min(1).max(280).optional(),
})

export type TwitterSocialPatchInput = z.infer<typeof TwitterSocialPatchSchema>

export const SocialPlatformStatusSchema = z.object({
  connected: z.boolean(),
  accountLabel: z.string().nullable(),
  onReleasePublished: z.boolean(),
  onChannelLive: z.boolean(),
  postTemplate: z.string(),
})

export const SocialSettingsViewSchema = z.object({
  mastodon: SocialPlatformStatusSchema,
  bluesky: SocialPlatformStatusSchema,
  twitter: SocialPlatformStatusSchema.extend({
    configured: z.boolean(),
  }),
})

export const SocialPostLogSchema = z.object({
  id: z.string(),
  platform: z.enum(['MASTODON', 'BLUESKY', 'TWITTER']),
  trigger: z.string(),
  state: z.enum(['PENDING', 'SENT', 'FAILED']),
  message: z.string(),
  externalId: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.coerce.date(),
  sentAt: z.coerce.date().nullable(),
})

export const LegacySubscriptionMemberSchema = z.object({
  id: z.string(),
  memberNumber: z.number().int().nullable(),
  displayName: z.string(),
  email: z.string(),
  username: z.string(),
  memberSince: z.coerce.date().nullable(),
})

export const LegacySubscriptionMemberListSchema = z.array(LegacySubscriptionMemberSchema)

export type MastodonConnectInput = z.infer<typeof MastodonConnectSchema>
export type BlueskyConnectInput = z.infer<typeof BlueskyConnectSchema>
