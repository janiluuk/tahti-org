// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const UserSearchResultSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
})
export const UserSearchResponseSchema = z.array(UserSearchResultSchema)

export const ConversationParticipantSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  /** Channel owner or assigned moderator — used to highlight staff in DMs. */
  channelRole: z.enum(['owner', 'moderator']).nullable().optional(),
})

export const ConversationSummarySchema = z.object({
  id: z.string(),
  otherUser: ConversationParticipantSchema,
  lastMessage: z
    .object({
      body: z.string(),
      senderUsername: z.string(),
      createdAt: z.string().datetime(),
    })
    .nullable(),
  unreadCount: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
})
export const ConversationListSchema = z.array(ConversationSummarySchema)

export const MessageContactSchema = ConversationParticipantSchema.extend({
  followsYou: z.boolean(),
  followedByYou: z.boolean(),
})
export const MessageContactListSchema = z.array(MessageContactSchema)

export const MessageSchema = z.object({
  id: z.string(),
  senderUsername: z.string(),
  senderDisplayName: z.string(),
  senderAvatarUrl: z.string().nullable(),
  body: z.string(),
  createdAt: z.string().datetime(),
  isMine: z.boolean(),
  senderChannelRole: z.enum(['owner', 'moderator']).nullable().optional(),
})

export const ConversationDetailSchema = z.object({
  id: z.string(),
  otherUser: ConversationParticipantSchema,
  /** Oldest first. */
  messages: z.array(MessageSchema),
  /** More messages older than the first one returned; page with
   * `?before=<first message id>`. */
  hasMore: z.boolean(),
})

export const CONVERSATION_PAGE_LIMIT = 200

export const ConversationDetailQuerySchema = z.object({
  /** A message id from this conversation, or an ISO date-time. */
  before: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(CONVERSATION_PAGE_LIMIT).optional(),
})

export const SendMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(2000),
})

export const StartConversationSchema = z.object({
  username: z.string().trim().min(1, 'username is required'),
})

export const StartConversationResponseSchema = z.object({
  conversationId: z.string(),
})
