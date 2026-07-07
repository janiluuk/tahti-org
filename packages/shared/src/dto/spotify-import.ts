// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const SpotifyTrackResultSchema = z.object({
  uri: z.string(),
  title: z.string(),
  artists: z.array(z.string()),
  album: z.string().nullable(),
  durationSec: z.number().int().nonnegative(),
  coverUrl: z.string().nullable(),
})

export const SpotifySearchResponseSchema = z.object({
  tracks: z.array(SpotifyTrackResultSchema),
})

export const SpotifyMeTracksResponseSchema = z.object({
  artistId: z.string().nullable(),
  tracks: z.array(SpotifyTrackResultSchema),
})

export const SpotifyByArtistUrlQuerySchema = z.object({
  artistUrl: z.string().min(1),
})

export const SpotifyAddTrackRequestSchema = z.object({
  collectionId: z.string().min(1),
  spotifyUri: z.string().regex(/^spotify:track:[A-Za-z0-9]+$/, 'Expected a spotify:track:... URI'),
})

export const SpotifyAddTrackResponseSchema = z.object({
  archiveItemId: z.string(),
  collectionItemId: z.string(),
  track: SpotifyTrackResultSchema,
})

export const SpotifyArtistProfileSchema = z.object({
  artistId: z.string(),
  name: z.string(),
  imageUrl: z.string().nullable(),
})

export const SpotifyProfileStatusResponseSchema = z.object({
  configured: z.boolean(),
  profile: SpotifyArtistProfileSchema.nullable(),
})

export const SpotifyLinkProfileRequestSchema = z.object({
  artistUrl: z.string().min(1),
})
