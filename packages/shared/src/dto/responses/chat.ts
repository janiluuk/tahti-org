// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const ChatTokenResponseSchema = z.object({
  token: z.string(),
  handle: z.string(),
  fingerprint: z.string(),
  supporter: z.boolean(),
  countryCode: z.string().nullable(),
  channelRole: z.enum(['owner', 'moderator']).nullable(),
})

export const ChatTokenOnlyResponseSchema = z.object({
  token: z.string(),
})

export const ChatOkResponseSchema = z.object({
  ok: z.literal(true),
})

export const ChatPresenceResponseSchema = z.object({
  numClients: z.number().int().nonnegative(),
})

export const ChatDailyListenersResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  /** False when the artist has turned this off in their settings — the
   * count itself is still computed above but callers should not display it. */
  enabled: z.boolean(),
})

export const ChatHistoryMessageSchema = z.object({
  handle: z.string(),
  text: z.string(),
  ts: z.number(),
  supporter: z.boolean().optional(),
  channelRole: z.enum(['owner', 'moderator']).nullable().optional(),
  countryCode: z.string().nullable().optional(),
  system: z.boolean().optional(),
  href: z.string().optional(),
})

export const ChatHistoryResponseSchema = z.object({
  messages: z.array(ChatHistoryMessageSchema),
})

export const ChatAnnouncementViewSchema = z.object({
  id: z.string(),
  body: z.string(),
  createdAt: z.coerce.date(),
})

export const ChatAnnouncementListSchema = z.array(ChatAnnouncementViewSchema)

export const ChannelModeratorViewSchema = z.object({
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
  grantedAt: z.coerce.date(),
})

export const ChannelModeratorListSchema = z.array(ChannelModeratorViewSchema)

export const ModeratedChannelViewSchema = z.object({
  slug: z.string(),
  displayName: z.string(),
  isOwner: z.boolean(),
})

export const ModeratedChannelListSchema = z.array(ModeratedChannelViewSchema)

export const ChatBanViewSchema = z.object({
  fingerprintHash: z.string(),
  bannedAt: z.coerce.date(),
})

export const ChatBanListSchema = z.array(ChatBanViewSchema)

export const ChatAccessResponseSchema = z.object({
  fanChatEnabled: z.boolean(),
  isSupporter: z.boolean(),
  canJoinFanChat: z.boolean(),
  subscribersOnly: z.boolean(),
  canPostInChat: z.boolean(),
})

export const ChatFanTokenResponseSchema = z.object({
  token: z.string(),
  handle: z.string(),
  channel: z.string(),
  supporter: z.literal(true),
})

export const ChatPublishAckSchema = z.object({
  result: z.object({}).passthrough(),
})
