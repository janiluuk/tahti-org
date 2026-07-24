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

export const MessageSchema = z.object({
  id: z.string(),
  senderUsername: z.string(),
  senderDisplayName: z.string(),
  senderAvatarUrl: z.string().nullable(),
  body: z.string(),
  createdAt: z.string().datetime(),
  isMine: z.boolean(),
})

export const ConversationDetailSchema = z.object({
  id: z.string(),
  otherUser: ConversationParticipantSchema,
  messages: z.array(MessageSchema),
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
