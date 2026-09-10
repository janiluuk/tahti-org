// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const OEmbedResponseSchema = z
  .object({
    version: z.literal('1.0'),
    type: z.literal('rich'),
    title: z.string(),
    author_name: z.string(),
    author_url: z.string().url(),
    provider_name: z.string(),
    provider_url: z.string().url(),
    html: z.string(),
    width: z.number().int(),
    height: z.number().int(),
  })
  .passthrough()

export const ReleaseEmbedViewSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    type: z.string(),
    smartLinkSlug: z.string().nullable(),
    embedUrl: z.string().url(),
    profileUrl: z.string().url(),
    artist: z.object({
      username: z.string(),
      displayName: z.string(),
    }),
    tracks: z.array(
      z.object({
        id: z.string(),
        position: z.number().int(),
        title: z.string(),
        hasStream: z.boolean(),
        /** Cached [0..255] amplitude buckets — null until the track's transcode
         * has run (or for tracks uploaded before ReleaseTrack.peaks existed). */
        peaks: z.array(z.number()).nullable(),
      }),
    ),
  })
  .passthrough()

export const ChannelEmbedViewSchema = z.object({
  slug: z.string(),
  state: z.string(),
  embedUrl: z.string().url(),
  profileUrl: z.string().url(),
  hlsUrl: z.string().nullable(),
  artist: z.object({
    username: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
})

export const EmbedTrackPlaySchema = z.object({
  url: z.string().url(),
  title: z.string(),
  expiresInSec: z.number().int(),
  /** Cached [0..255] amplitude buckets, returned alongside the signed play URL
   * so the embed player can render a real waveform without a second request —
   * embeds have no other (authenticated) route to fetch this. Null if not
   * cached yet. */
  peaks: z.array(z.number()).nullable(),
})

export const CollectionEmbedViewSchema = z.object({
  slug: z.string(),
  name: z.string(),
  coverUrl: z.string().nullable(),
  embedUrl: z.string().url(),
  profileUrl: z.string().url(),
  artist: z.object({
    username: z.string(),
    displayName: z.string(),
  }),
  tracks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      durationSec: z.number().int().nullable(),
      hasStream: z.boolean(),
      embedProvider: z.enum(['SPOTIFY', 'MIXCLOUD', 'HEARTHIS']).nullable(),
      embedUri: z.string().nullable(),
      /** Cached [0..255] amplitude buckets — null for embed-only tracks
       * (no local audio to analyze) or ones transcoded before this existed. */
      peaks: z.array(z.number()).nullable(),
    }),
  ),
})
