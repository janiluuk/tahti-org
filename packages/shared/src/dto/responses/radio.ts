// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { ColorSchemeSchema } from '../visual-preset.js'

export const RadioNowPlayingSchema = z
  .object({
    live: z.boolean(),
    channel: z.unknown().nullable(),
  })
  .passthrough()

/** Public, read-only view of the Tahti Selects curated rotation order (STREAM-011).
 * artistUsername is null for curated/compilation tracks with an artistName
 * override (e.g. Tahti Selects' CC0 rotation) — there's no real Tahti profile
 * to link the name to. */
export const RadioRotationItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  artistName: z.string(),
  artistUsername: z.string().nullable(),
  artworkUrl: z.string().nullable(),
})

export const RadioRotationSchema = z.array(RadioRotationItemSchema)

/** Public "recently played" history — distinct from RadioRotationSchema (the
 * curated rotation's set order) and RadioFeatureHistorySchema (which artists'
 * live streams were relayed) — this is what actually played, most recent first. */
export const RadioRecentlyPlayedItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  artistName: z.string(),
  artistUsername: z.string().nullable(),
  artworkUrl: z.string().nullable(),
  playedAt: z.string(),
})

export const RadioRecentlyPlayedSchema = z.array(RadioRecentlyPlayedItemSchema)

/** Public homepage news feed entry — always carries a byline. */
export const NewsPostSchema = z.object({
  id: z.string(),
  headline: z.string(),
  summary: z.string(),
  authorName: z.string(),
  publishedAt: z.string(),
})

export const NewsFeedResponseSchema = z.array(NewsPostSchema)

/** Public, read-only view of booked live-artist slots on Tahti Radio. */
export const PublicRadioSlotSchema = z.object({
  id: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  note: z.string().nullable(),
  showType: z.enum(['LIVE_SET', 'TALK']),
  /** Stream-overlay cover when the artist set one; otherwise null (UI falls back to avatar). */
  coverUrl: z.string().nullable(),
  /** Accent/bg from the artist's profile-pic palette (or channel brand scheme). */
  colorScheme: ColorSchemeSchema.nullable(),
  /** Artist's next upcoming booking start (may be this slot). */
  nextShowAt: z.string().nullable(),
  /** Artist's most recent past booking start. */
  lastShowAt: z.string().nullable(),
  artist: z.object({
    displayName: z.string(),
    username: z.string(),
    avatarUrl: z.string().nullable(),
    channelSlug: z.string().nullable(),
  }),
})

export const PublicRadioSlotListSchema = z.array(PublicRadioSlotSchema)

/** Radio "show" detail page — an artist's Tahti Radio booking history + what's
 * still ahead. There's no separate Show entity; a "show" is just the set of
 * RadioSlotBooking rows for one artist's channel. */
export const RadioShowEpisodeSchema = z.object({
  id: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  note: z.string().nullable(),
  showType: z.enum(['LIVE_SET', 'TALK']),
  /** Set only for a past episode the artist actually broadcast AND published
   * to their sound afterward — null for a past slot with no broadcast (a
   * no-show) or one the artist hasn't published a recording of. */
  recording: z
    .object({
      soundId: z.string(),
      title: z.string(),
      channelItemUrl: z.string(),
    })
    .nullable(),
})

export const RadioShowDetailSchema = z.object({
  artist: z.object({
    displayName: z.string(),
    username: z.string(),
    avatarUrl: z.string().nullable(),
    channelSlug: z.string(),
    bio: z.string().nullable(),
    coverUrl: z.string().nullable(),
    colorScheme: ColorSchemeSchema.nullable(),
  }),
  pastEpisodes: z.array(RadioShowEpisodeSchema),
  upcomingEpisodes: z.array(RadioShowEpisodeSchema),
  nextShowAt: z.string().nullable(),
  lastShowAt: z.string().nullable(),
})

export type RadioShowDetail = z.infer<typeof RadioShowDetailSchema>

export const ChannelProgrammeItemViewSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  durationSec: z.number().nullable(),
  isFallback: z.boolean(),
  fallbackOrder: z.number().int().nullable(),
  lastFallbackPlayedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  /** Presigned playback URL for the editor's preview button — null when neither
   * mp3Key nor flacKey is set (should not happen for a READY item, but the
   * playback key resolver is intentionally defensive). */
  audioUrl: z.string().nullable(),
})

export const ChannelProgrammeLibraryTrackViewSchema = z.object({
  releaseTrackId: z.string(),
  releaseId: z.string(),
  releaseTitle: z.string(),
  trackTitle: z.string(),
  durationSec: z.number().nullable(),
  /** Set once this library track has been added to rotation (mirrors an Sound). */
  soundId: z.string().nullable(),
})

export const ChannelProgrammeViewSchema = z.object({
  fallbackMode: z.enum(['shuffle', 'ordered']),
  fallbackEnabled: z.boolean(),
  fallbackAutoEnroll: z.boolean(),
  announcementsEnabled: z.boolean(),
  items: z.array(ChannelProgrammeItemViewSchema),
  library: z.array(ChannelProgrammeLibraryTrackViewSchema),
})

export const MetaStreamOptResponseSchema = z.object({
  metaStreamOptOut: z.boolean(),
})

export const RadioFeatureHistoryItemSchema = z.object({
  channelId: z.string(),
  slug: z.string(),
  artistName: z.string(),
  featuredAt: z.coerce.date(),
})

export const RadioFeatureHistorySchema = z.array(RadioFeatureHistoryItemSchema)

export const RadioFeaturedPatchSchema = z.object({
  channelId: z.string().min(1),
})
