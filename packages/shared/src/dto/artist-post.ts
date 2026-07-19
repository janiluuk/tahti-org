// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const CreateArtistPostSchema = z.object({
  title: z.string().trim().max(160).optional(),
  body: z.string().trim().min(1, 'body is required').max(5000),
  /** Omit (or set to now/past) to publish immediately; a future time schedules it. */
  publishAt: z.string().datetime().optional(),
})

export type CreateArtistPostInput = z.infer<typeof CreateArtistPostSchema>

export const ArtistPostSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  body: z.string(),
  images: z.array(z.string()),
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
