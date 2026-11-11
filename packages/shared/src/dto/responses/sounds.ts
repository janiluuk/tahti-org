// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { PlaybackGateSchema } from './channels.js'

export const SoundViewSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
    processingError: z.string().nullable().optional(),
    effectiveBpm: z.number().nullable().optional(),
    effectiveKey: z.string().nullable().optional(),
    sourceFormat: z.string().nullable().optional(),
    sourceBitrateKbps: z.number().int().nullable().optional(),
    sourceSampleRateHz: z.number().int().nullable().optional(),
    sourceBitDepth: z.number().int().nullable().optional(),
    sourceChannels: z.number().int().nullable().optional(),
    downloadsEnabled: z.boolean().optional(),
    bannerUrl: z.string().nullable().optional(),
    /** Set for tracks imported as an embed (SPOTIFY, MIXCLOUD, HEARTHIS,
     * MIKSERI, ...); the provider's widget plays them. */
    embedProvider: z.string().nullable().optional(),
    embedUri: z.string().nullable().optional(),
    /** The provider page the embed was imported from (hearthis.at track page,
     * ...). Null for older hearthis.at embeds that only kept the track id. */
    embedSourceUrl: z.string().nullable().optional(),
  })
  .passthrough()

export const SoundListSchema = z.array(SoundViewSchema)

/** Paged artist sound list — returned by GET /api/me/sound when `limit` is set. */
export const SoundListPageSchema = z.object({
  items: z.array(SoundViewSchema),
  total: z.number().int().nonnegative(),
})

export type SoundListPage = z.infer<typeof SoundListPageSchema>

/** GET /api/me/sound: the paged object with `limit`, the legacy array
 * without it. Both shapes must be in the response schema, or Fastify's
 * serializer rejects the legacy array with a 500. */
export const SoundListResponseSchema = z.union([SoundListPageSchema, SoundListSchema])

export const SoundIdsSchema = z.object({
  ids: z.array(z.string()),
  total: z.number().int().nonnegative(),
})

export type SoundIds = z.infer<typeof SoundIdsSchema>

export const SoundFacetValueSchema = z.object({
  value: z.string(),
  count: z.number().int().nonnegative(),
})

export const SoundFacetsSchema = z.object({
  facets: z.record(z.string(), z.array(SoundFacetValueSchema)),
  total: z.number().int().nonnegative(),
})

export type SoundFacets = z.infer<typeof SoundFacetsSchema>

export const SoundStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  durationSec: z.number().int().nonnegative(),
  publicCount: z.number().int().nonnegative(),
  privateCount: z.number().int().nonnegative(),
  processingCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  readyCount: z.number().int().nonnegative(),
})

export type SoundStats = z.infer<typeof SoundStatsSchema>

export const SoundBulkFailureSchema = z.object({
  id: z.string(),
  error: z.string(),
})

export const SoundBulkDeleteResultSchema = z.object({
  deleted: z.number().int().nonnegative(),
  failed: z.array(SoundBulkFailureSchema),
  totalMatched: z.number().int().nonnegative(),
})

export type SoundBulkDeleteResult = z.infer<typeof SoundBulkDeleteResultSchema>

export const SoundBulkPatchResultSchema = z.object({
  updated: z.number().int().nonnegative(),
  failed: z.array(SoundBulkFailureSchema),
  totalMatched: z.number().int().nonnegative(),
})

export type SoundBulkPatchResult = z.infer<typeof SoundBulkPatchResultSchema>

/** 409 when bulk filter `confirmTotal` drifts from the live match count. */
export const SoundBulkConflictSchema = z.object({
  error: z.string(),
  totalMatched: z.number().int().nonnegative().optional(),
})

export type SoundBulkConflict = z.infer<typeof SoundBulkConflictSchema>

/** Shared `{ error }` body for 400/403 on sound routes. */
export const SoundErrorMessageSchema = z.object({
  error: z.string(),
})

/** POST /api/me/sound/covers/backfill — assign preset covers to sounds with none. */
export const SoundCoversBackfillResultSchema = z.object({
  assigned: z.number().int().nonnegative(),
  totalMatched: z.number().int().nonnegative(),
})

export type SoundCoversBackfillResult = z.infer<typeof SoundCoversBackfillResultSchema>

/** Cheap total-count response, used by dashboard tiles that only need a
 * number rather than the full list (PERF: avoids GET /api/me/sound's
 * full-metadata payload just to read `.length`). */
export const CountSchema = z.object({ count: z.number().int() })

/** The studio top bar's upload indicator: sounds still being processed, and
 * the final status of the watched ids (uploads started in this browser)
 * once they finish. */
export const SoundProcessingStatusSchema = z.object({
  processing: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      status: z.enum(['PENDING', 'PROCESSING']),
    }),
  ),
  settled: z.array(
    z.object({
      id: z.string(),
      status: z.enum(['READY', 'ERROR']),
      processingError: z.string().nullable().optional(),
    }),
  ),
})

export const SoundRetryProcessingSchema = z.object({
  id: z.string(),
  status: z.literal('PENDING'),
})

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
    /** Artist-defined free-form labels, as written. `GET /api/v1/search?tag=`
     * finds other public tracks carrying the same tag. */
    tags: z.array(z.string()),
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
    /** Artist-declared: the track was made with generative AI. Shown as a
     * label on the public track page. */
    isAiGenerated: z.boolean(),
    /** [0..255] amplitude buckets for the real waveform — null for tracks
     * ingested before M27 or without a decodable audio file. */
    peaks: z.array(z.number()).nullable(),
    /** Set for tracks imported as an embed (Spotify, Mixcloud, hearthis.at,
     * ...): the page plays them through the provider's widget, since
     * `audioUrl` is null. */
    embedProvider: z
      .enum(['SPOTIFY', 'MIXCLOUD', 'YOUTUBE', 'APPLE', 'GENERIC', 'HEARTHIS', 'MIKSERI'])
      .nullable(),
    embedUri: z.string().nullable(),
    /** Where the track was recorded - only a verified venue (one with a
     * public page), else null. */
    venue: z.object({ name: z.string(), slug: z.string() }).nullable(),
    commentCount: z.number().int(),
    likeCount: z.number().int(),
    /** Deduplicated plays (listen events). */
    playCount: z.number().int(),
    downloadCount: z.number().int(),
    /** False = the artist turned downloads off; the download routes answer 403 `downloads_disabled`. */
    downloadsEnabled: z.boolean(),
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
