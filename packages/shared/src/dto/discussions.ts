// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const DiscussionTopicStatusSchema = z.enum(['OPEN', 'CLOSED'])

/** POST /api/admin/discussions — the board opens a topic. */
export const CreateDiscussionTopicSchema = z.object({
  title: z.string().trim().min(3, 'Give the topic a title').max(160),
  body: z.string().trim().min(1, 'Say what the topic is about').max(10_000),
  pinned: z.boolean().optional(),
})

/** PATCH /api/admin/discussions/:id */
export const UpdateDiscussionTopicSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    body: z.string().trim().min(1).max(10_000),
    status: DiscussionTopicStatusSchema,
    pinned: z.boolean(),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, { message: 'Nothing to update' })

export const DiscussionTopicViewSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  status: DiscussionTopicStatusSchema,
  pinned: z.boolean(),
  createdBy: z.string(),
  postCount: z.number().int(),
  lastPostAt: z.string(),
  createdAt: z.string(),
})

export const DiscussionPostViewSchema = z.object({
  id: z.string(),
  body: z.string(),
  author: z.string(),
  createdAt: z.string(),
})

export const CreateDiscussionPostSchema = z.object({
  body: z.string().trim().min(1).max(5000),
})

export const DiscussionTopicListSchema = z.object({
  topics: z.array(DiscussionTopicViewSchema.extend({ following: z.boolean(), muted: z.boolean() })),
})

export const DiscussionTopicDetailSchema = DiscussionTopicViewSchema.extend({
  following: z.boolean(),
  muted: z.boolean(),
  posts: z.array(DiscussionPostViewSchema),
})

export type CreateDiscussionPostInput = z.infer<typeof CreateDiscussionPostSchema>
export type DiscussionPostView = z.infer<typeof DiscussionPostViewSchema>
export type CreateDiscussionTopicInput = z.infer<typeof CreateDiscussionTopicSchema>
export type UpdateDiscussionTopicInput = z.infer<typeof UpdateDiscussionTopicSchema>
export type DiscussionTopicView = z.infer<typeof DiscussionTopicViewSchema>
