// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const SearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  type: z.enum(['all', 'tracks', 'artists', 'collections']).default('all'),
  count: z.coerce.number().int().min(1).max(50).default(20),
})

export const SearchTrackResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  artistName: z.string(),
  channelSlug: z.string(),
  durationSec: z.number().int().nullable(),
  coverUrl: z.string().nullable(),
})

export const SearchArtistResultSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  channelSlug: z.string().nullable(),
})

export const SearchCollectionResultSchema = z.object({
  slug: z.string(),
  name: z.string(),
  coverUrl: z.string().nullable(),
  ownerUsername: z.string(),
  ownerDisplayName: z.string(),
})

export const SearchResponseSchema = z.object({
  tracks: z.array(SearchTrackResultSchema),
  artists: z.array(SearchArtistResultSchema),
  collections: z.array(SearchCollectionResultSchema),
})

export type SearchResponse = z.infer<typeof SearchResponseSchema>
