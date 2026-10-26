// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const MeListeningQuerySchema = z.object({
  range: z.enum(['7', '30', 'all']).default('30'),
})

export const MeListeningArtistSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  minutes: z.number().int().nonnegative(),
})

export const MeListeningTrackSchema = z.object({
  soundId: z.string(),
  title: z.string(),
  artistName: z.string(),
  minutes: z.number().int().nonnegative(),
})

export const MeListeningResponseSchema = z.object({
  range: z.enum(['7', '30', 'all']),
  minutes: z.number().int().nonnegative(),
  listens: z.number().int().nonnegative(),
  topArtists: z.array(MeListeningArtistSchema),
  topTracks: z.array(MeListeningTrackSchema),
})

export type MeListeningResponse = z.infer<typeof MeListeningResponseSchema>
