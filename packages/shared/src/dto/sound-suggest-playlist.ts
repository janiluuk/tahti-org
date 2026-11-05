// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** POST /api/me/sound/suggest-playlist — your own sounds to put in mix order. */
export const SuggestPlaylistBodySchema = z.object({
  ids: z.array(z.string().min(1)).min(2).max(500),
})

export const SuggestedPlaylistTrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  bpm: z.number().nullable(),
  key: z.string().nullable(),
})

export const SuggestedPlaylistSchema = z.object({
  /** Mix order: slowest keyed track first, then the smoothest key/tempo step. */
  items: z.array(SuggestedPlaylistTrackSchema.extend({ camelot: z.string() })),
  /** Tracks with no readable key, in the order they were sent. */
  unplaced: z.array(SuggestedPlaylistTrackSchema),
})

export type SuggestedPlaylist = z.infer<typeof SuggestedPlaylistSchema>
