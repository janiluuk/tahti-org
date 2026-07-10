// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const CreateArtistEmbedSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'url is required')
    .max(500)
    .refine((v) => /^https:\/\/(www\.)?soundcloud\.com\//i.test(v), {
      message: 'Only soundcloud.com track URLs are supported right now',
    }),
})

export type CreateArtistEmbedInput = z.infer<typeof CreateArtistEmbedSchema>

export const ArtistEmbedSchema = z.object({
  id: z.string(),
  provider: z.literal('soundcloud'),
  url: z.string(),
  title: z.string().nullable(),
  authorName: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
})

export type ArtistEmbedView = z.infer<typeof ArtistEmbedSchema>

export const ArtistEmbedListSchema = z.array(ArtistEmbedSchema)
