// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const ARTIST_POST_CATEGORIES = ['STORY', 'NEWS', 'ANNOUNCEMENT'] as const

export const ArtistPostCategorySchema = z.enum(ARTIST_POST_CATEGORIES)

export type ArtistPostCategory = z.infer<typeof ArtistPostCategorySchema>

export const CreateArtistPostSchema = z.object({
  title: z.string().trim().max(160).optional(),
  body: z.string().trim().min(1, 'body is required').max(5000),
  linkUrl: z.string().trim().url().max(500).optional(),
  linkLabel: z.string().trim().max(100).optional(),
  category: ArtistPostCategorySchema.optional(),
  /** Omit (or set to now/past) to publish immediately; a future time schedules it. */
  publishAt: z.string().datetime().optional(),
})

export type CreateArtistPostInput = z.infer<typeof CreateArtistPostSchema>

export const UpdateArtistPostSchema = z.object({
  title: z.string().trim().max(160).nullable().optional(),
  body: z.string().trim().min(1, 'body is required').max(5000).optional(),
  linkUrl: z.string().trim().url().max(500).nullable().optional(),
  linkLabel: z.string().trim().max(100).nullable().optional(),
  category: ArtistPostCategorySchema.optional(),
  /** Reschedule (future) or re-publish (now/past) by changing this. */
  publishAt: z.string().datetime().optional(),
})

export type UpdateArtistPostInput = z.infer<typeof UpdateArtistPostSchema>

export const ArtistPostSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  body: z.string(),
  images: z.array(z.string()),
  linkUrl: z.string().nullable(),
  linkLabel: z.string().nullable(),
  category: ArtistPostCategorySchema,
  publishAt: z.string().datetime(),
  createdAt: z.string().datetime(),
})

export type ArtistPostView = z.infer<typeof ArtistPostSchema>

export const ArtistPostListSchema = z.array(ArtistPostSchema)

export const ArtistPostImagePrepareSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
})

export const ArtistPostImagePrepareResponseSchema = z.object({
  uploadKey: z.string(),
  uploadUrl: z.string().url(),
  expiresAt: z.string().datetime(),
})

export const ArtistPostImageCompleteSchema = z.object({
  uploadKey: z.string().trim().min(1),
})

export const COMMUNITY_STORIES_DEFAULT_LIMIT = 12
export const COMMUNITY_STORIES_MAX_LIMIT = 30
export const COMMUNITY_STORY_EXCERPT_MAX = 280

export const CommunityStoriesQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .default(COMMUNITY_STORIES_DEFAULT_LIMIT)
    .transform((n) => Math.min(n, COMMUNITY_STORIES_MAX_LIMIT)),
})

export const CommunityStorySchema = z.object({
  id: z.string(),
  category: ArtistPostCategorySchema,
  title: z.string().nullable(),
  excerpt: z.string(),
  imageUrl: z.string().nullable(),
  publishAt: z.string().datetime(),
  url: z.string(),
  author: z.object({
    username: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
})

export type CommunityStory = z.infer<typeof CommunityStorySchema>

export const CommunityStoriesResponseSchema = z.object({
  items: z.array(CommunityStorySchema),
  nextCursor: z.string().nullable(),
})

export type CommunityStoriesResponse = z.infer<typeof CommunityStoriesResponseSchema>
