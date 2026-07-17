// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const CommentBodySchema = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(2000),
})
export type CommentBodyInput = z.infer<typeof CommentBodySchema>

export const CommentItemSchema = z.object({
  id: z.string(),
  body: z.string(),
  authorUsername: z.string(),
  authorDisplayName: z.string(),
  authorAvatarUrl: z.string().nullable(),
  createdAt: z.coerce.date(),
})
export type CommentItem = z.infer<typeof CommentItemSchema>

export const CommentsListSchema = z.object({
  comments: z.array(CommentItemSchema),
  commentsEnabled: z.boolean(),
})
export type CommentsListResponse = z.infer<typeof CommentsListSchema>

/** Per-track / per-channel override — always a single required boolean, matching ChatSettingsPatchSchema. */
export const CommentsEnabledPatchSchema = z.object({
  commentsEnabled: z.boolean(),
})
export type CommentsEnabledPatchInput = z.infer<typeof CommentsEnabledPatchSchema>

/** User-level defaults applied to new tracks/channel — both optional, at least one required. */
export const CommentDefaultsPatchSchema = z
  .object({
    defaultTrackCommentsEnabled: z.boolean().optional(),
    defaultChannelCommentsEnabled: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' })
export type CommentDefaultsPatchInput = z.infer<typeof CommentDefaultsPatchSchema>

export const CommentDefaultsResponseSchema = z.object({
  defaultTrackCommentsEnabled: z.boolean(),
  defaultChannelCommentsEnabled: z.boolean(),
})
