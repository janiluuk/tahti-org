// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const MentionsEnabledResponseSchema = z.object({
  mentionsEnabled: z.boolean(),
  publicMentionsEnabled: z.boolean(),
})

export const PublicMentionItemSchema = z.object({
  id: z.string(),
  surface: z.string(),
  createdAt: z.coerce.date(),
  mentioner: z.object({
    username: z.string(),
    displayName: z.string(),
  }),
  sourceId: z.string().optional(),
  sourceTitle: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
})

export const PublicMentionListSchema = z.array(PublicMentionItemSchema)

export const MentionMutedResponseSchema = z.object({
  muted: z.string(),
})

export const MentionUnmutedResponseSchema = z.object({
  unmuted: z.string(),
})

export const MentionMutedUserSchema = z.object({
  username: z.string(),
  displayName: z.string(),
})

/** GET /api/me/mentions/settings */
export const MentionSettingsSchema = z.object({
  mentionsEnabled: z.boolean(),
  publicMentionsEnabled: z.boolean(),
  muted: z.array(MentionMutedUserSchema),
})

export const MentionInboxItemSchema = z.object({
  id: z.string(),
  surface: z.string(),
  sourceId: z.string(),
  createdAt: z.coerce.date(),
  mentioner: z.object({
    username: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  sourceTitle: z.string().nullable(),
  sourceUrl: z.string().nullable(),
})

/** GET /api/me/mentions — incoming mentions for the signed-in artist. */
export const MentionsInboxSchema = z.object({
  mentions: z.array(MentionInboxItemSchema),
})
