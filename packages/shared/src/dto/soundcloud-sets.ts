// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** One of the connected user's SoundCloud playlists/sets, without its tracks. */
export const SoundcloudPlaylistSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  trackCount: z.number().int().nonnegative(),
  artworkUrl: z.string().nullable(),
  permalinkUrl: z.string().nullable(),
})

/**
 * A playlist entry. `download` is set only when SoundCloud marks the track as
 * downloadable for the connected user; its `url` is a short-lived Tahti link
 * that redirects to the file, so the OAuth token never leaves the server.
 */
export const SoundcloudPlaylistTrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  username: z.string(),
  durationSec: z.number().nonnegative(),
  artworkUrl: z.string().nullable(),
  permalinkUrl: z.string().nullable(),
  download: z
    .object({
      url: z.string(),
      /** ISO time after which `url` stops working; reload the playlist for new links. */
      expiresAt: z.string(),
    })
    .nullable(),
})

export const SoundcloudPlaylistsResponseSchema = z.object({
  playlists: z.array(SoundcloudPlaylistSummarySchema),
})

export const SoundcloudPlaylistTracksResponseSchema = z.object({
  tracks: z.array(SoundcloudPlaylistTrackSchema),
})

export const SoundcloudResolvePlaylistResponseSchema = z.object({
  playlist: SoundcloudPlaylistSummarySchema,
})

export type SoundcloudPlaylistSummary = z.infer<typeof SoundcloudPlaylistSummarySchema>
export type SoundcloudPlaylistTrack = z.infer<typeof SoundcloudPlaylistTrackSchema>
