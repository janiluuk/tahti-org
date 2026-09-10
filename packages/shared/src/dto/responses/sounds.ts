// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { PlaybackGateSchema } from './channels.js'

export const SoundViewSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
    effectiveBpm: z.number().nullable().optional(),
    effectiveKey: z.string().nullable().optional(),
    sourceFormat: z.string().nullable().optional(),
    sourceBitrateKbps: z.number().int().nullable().optional(),
    sourceSampleRateHz: z.number().int().nullable().optional(),
    sourceBitDepth: z.number().int().nullable().optional(),
    sourceChannels: z.number().int().nullable().optional(),
  })
  .passthrough()

export const SoundListSchema = z.array(SoundViewSchema)

// PERF-006: dashboard overview only ever shows the 1-2 most recent items — no need to
// pull the full 100-item, full-metadata payload GET /api/me/sound returns.
export const SoundRecentSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    durationSec: z.number().int().nullable(),
    createdAt: z.string(),
  }),
)

/** Public channel sound list (includes presigned audioUrl and full metadata). */
export const ChannelSoundsResponseSchema = z.array(z.record(z.string(), z.unknown()))

/** GET /api/tracks/:id — public single-track detail page. Unlike
 * ChannelSoundsResponseSchema (a list scoped to an already-known
 * channel) or TahtiSelectsGalleryItemSchema (gallery-tile summary), this is
 * the full-detail payload for a standalone track page reached only by
 * track id — includes the real waveform `peaks` buckets and the owning
 * channel/artist so the page never needs a second request. */
export const PublicTrackDetailSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    artistName: z.string(),
    channelSlug: z.string(),
    channel: z.object({
      username: z.string(),
      displayName: z.string(),
      avatarUrl: z.string().nullable(),
      bio: z.string().nullable(),
    }),
    durationSec: z.number().int().nullable(),
    audioUrl: z.string().nullable(),
    bannerUrl: z.string().nullable(),
    /** Wide backdrop image set in Studio's track editor — null falls back
     * to a gradient built from the track's own cover art on the client. */
    backgroundUrl: z.string().nullable().optional(),
    /** Gallery images for the track page backdrop when `galleryMode` is
     * STATIC_SLIDESHOW — same shape as the channel page's own gallery. */
    slideshowUrls: z.array(z.string()).optional(),
    galleryMode: z.string().nullable().optional(),
    genre: z.string().nullable(),
    subGenres: z.array(z.string()),
    contentType: z.string(),
    mixVersion: z.string().nullable(),
    description: z.string().nullable(),
    commentary: z.string().nullable(),
    tracklist: z.unknown().nullable(),
    credits: z.unknown().nullable(),
    license: z.string(),
    releasedAt: z.string(),
    effectiveBpm: z.number().nullable(),
    effectiveKey: z.string().nullable(),
    /** [0..255] amplitude buckets for the real waveform — null for tracks
     * ingested before M27 or without a decodable audio file. */
    peaks: z.array(z.number()).nullable(),
    commentCount: z.number().int(),
    downloadCount: z.number().int(),
    /** FREE | SUBSCRIBERS_ONLY | PURCHASE — one-time purchase tiers are distinct from fan-subs. */
    accessMode: z.enum(['FREE', 'SUBSCRIBERS_ONLY', 'PURCHASE']).optional(),
    purchaseTierId: z.string().nullable().optional(),
    purchaseTierName: z.string().nullable().optional(),
    purchaseTierPriceCents: z.number().int().nullable().optional(),
    /** True = buyer may enter any amount >= 0 ("pay what you want", incl.
     * free) instead of paying purchaseTierPriceCents exactly. */
    purchaseTierPriceOptional: z.boolean().optional(),
    gate: PlaybackGateSchema.optional(),
  })
  .passthrough()

export type PublicTrackDetail = z.infer<typeof PublicTrackDetailSchema>
