// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { ColorSchemeSchema } from '../visual-preset.js'

/** Channel page "Manage" tab — owner/board-only stats snapshot. */
export const ChannelManageStatsSchema = z.object({
  /** Live encoder bitrate, from Icecast — null whenever not currently broadcasting. */
  audioBitrateKbps: z.number().int().nullable(),
  /** Whether Icecast currently has a live source connected on this channel's
   * mount — false while offline, and also false if the channel is marked LIVE
   * in the DB but the encoder connection has actually dropped. */
  signalConnected: z.boolean(),
  /** Current listeners (Centrifugo presence — same count shown publicly). */
  listeners: z.number().int(),
  /** All-time highest concurrent-listener count observed. */
  listenerPeak: z.number().int(),
  /** All-time rotation/sound play-start count. */
  plays: z.number().int(),
  likes: z.number().int(),
  reposts: z.number().int(),
  /** Seconds since the current live broadcast started; null when not live. */
  liveDurationSec: z.number().int().nullable(),
  /** How many sound tracks are flagged for the 24/7 fallback rotation —
   * 0 means there's nothing to play when the channel isn't actually live. */
  rotationTrackCount: z.number().int(),
})

/** Channel page "Manage" tab — transport control acknowledgement (skip/previous/pause/resume). */
export const ChannelTransportOkResponseSchema = z.object({
  ok: z.literal(true),
})

/** Channel page "Manage" tab — one entry in the searchable playlist-switch dropdown. */
export const ChannelFallbackCollectionOptionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  trackCount: z.number().int(),
  active: z.boolean(),
})

export const ChannelFallbackCollectionsResponseSchema = z.array(
  ChannelFallbackCollectionOptionSchema,
)

export const PublicChannelUserSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  avatarPosterUrl: z.string().nullable().optional(),
  countryCode: z.string().nullable().optional(),
  pronouns: z.string().nullable().optional(),
  socialLinks: z.unknown().optional(),
  joinDate: z.string().datetime().nullable().optional(),
  /** True when the artist currently supports Tahti ry (association member). */
  isMember: z.boolean().optional(),
  chatEnabled: z.boolean().optional(),
  showPageHero: z.boolean().optional(),
})

export const PublicChannelViewSchema = z.object({
  slug: z.string(),
  state: z.string(),
  /** True only when there's a real ingest signal on the live mount right
   * now — `state === 'LIVE'` alone doesn't distinguish an actual human
   * broadcast from the always-on 24/7 fallback rotation, which also sets
   * state to LIVE. False whenever state isn't LIVE. */
  signalConnected: z.boolean(),
  hlsUrl: z.string().nullable(),
  nextBroadcastAt: z.string().datetime().nullable(),
  nextBroadcastNote: z.string().nullable(),
  galleryMode: z.string(),
  slideshowImages: z.array(z.string()),
  textLayerMode: z.string(),
  textLayerText: z.string(),
  textLayerAlign: z.string(),
  videoBackgroundUrl: z.string().nullable(),
  /** Channel page header banner treatment — VIDEO_LOOP reuses videoBackgroundUrl above. */
  headerStyle: z.string(),
  brandAccentPreset: z.string().nullable().optional(),
  // M31
  colorSchemeJson: z.string().nullable(),
  colorScheme: ColorSchemeSchema,
  visualPreset: z.string(),
  visualSettingsJson: z.string().nullable().optional(),
  slideshowPreset: z.string(),
  slideshowIntervalSeconds: z.number().int(),
  slideshowTransitionMs: z.number().int(),
  slideshowAutoplay: z.boolean(),
  // Channel Designer look extras
  usePlayerGradient: z.boolean().optional(),
  playerColorSchemeJson: z.string().nullable().optional(),
  useBackgroundGradient: z.boolean().optional(),
  backgroundColorSchemeJson: z.string().nullable().optional(),
  backgroundVisualPreset: z.string().nullable().optional(),
  nowPlayingOverlayStyle: z.string().nullable().optional(),
  nowPlayingOverlaySettingsJson: z.string().nullable().optional(),
  playerOverlayMode: z.string().optional(),
  playerOverlayText: z.string().optional(),
  playerOverlayAlign: z.string().optional(),
  channelLinksJson: z.string().nullable().optional(),
  user: PublicChannelUserSchema,
  // STREAM-012: current rotation track, resolved from Liquidsoap telnet metadata
  // by the orchestrator poller. Null while nobody has synced yet, or while a
  // live artist is on air (the booking is the source of truth there instead).
  nowPlaying: z
    .object({
      title: z.string(),
      artistName: z.string(),
      artistUsername: z.string().nullable(),
      artworkUrl: z.string().nullable(),
      /** Source Sound.durationSec — null for an item with no known
       * duration, e.g. one that came in as an embed rather than a real file. */
      durationSec: z.number().nullable(),
      /** When this track started — remaining time is durationSec minus the
       * elapsed time since this timestamp. */
      startedAt: z.string(),
    })
    .nullable(),
  // Curated-rotation channels only (Tahti Selects): the next track in the
  // fixed playlist order, so the player can show "Next: ..." instead of a
  // bare "LIVE"/"REPLAY" label next to the play button.
  nowPlayingNext: z
    .object({
      title: z.string(),
      artistName: z.string(),
      artistUsername: z.string().nullable(),
    })
    .nullable(),
})

export const ChannelCardNowPlayingSchema = z.object({
  title: z.string(),
  artistName: z.string(),
  artworkUrl: z.string().nullable(),
})

export const ChannelCardSchema = z.object({
  slug: z.string(),
  state: z.string(),
  goneLiveAt: z.string().datetime().nullable(),
  nextBroadcastAt: z.string().datetime().nullable(),
  nextBroadcastNote: z.string().nullable(),
  genres: z.array(z.string()),
  /** Channel is actively airing its 24/7 sound rotation right now (not
   * live) — shown as "REPLAY" on the Discover page, same convention as the
   * mini-player's REPLAY badge for Tahti Radio's own rotation. */
  fallbackEnabled: z.boolean(),
  /** Playable straight from the Discover page's card — only set when
   * state === 'LIVE' (the "replaying" 24/7 fallback rotation uses a separate
   * playback path the card doesn't attempt inline). */
  hlsUrl: z.string().nullable(),
  /** Fresh (< 2 min old) now-playing metadata, when available — the card's
   * artwork prefers this over the artist's own avatar. */
  nowPlaying: ChannelCardNowPlayingSchema.nullable(),
  user: PublicChannelUserSchema,
})

export const ChannelListResponseSchema = z.object({
  live: z.array(ChannelCardSchema),
  /** Not live, but currently airing their sound rotation (fallbackEnabled) — REPLAY. */
  replaying: z.array(ChannelCardSchema),
  recent: z.array(ChannelCardSchema),
})

export type ChannelCard = z.infer<typeof ChannelCardSchema>

export type ChannelListResponse = z.infer<typeof ChannelListResponseSchema>

/** Discover → "Artists" tab: every channel with a public sound item, not just
 * currently live/recent ones. */
export const ChannelDirectoryEntrySchema = z.object({
  slug: z.string(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  genres: z.array(z.string()),
  /** Live right now, or airing its 24/7 fallback rotation — otherwise not
   * currently playing anything (still browsable, just tagged separately). */
  isActive: z.boolean(),
  /** Self-selected artist roles (dj/producer/band/etc) — see
   * ARTIST_ROLE_OPTIONS in tahti-web's SettingsPanels.tsx. */
  artistRoles: z.array(z.string()),
  /** True while the channel is live right now — the "radio host" directory
   * filter's definition of "having an active running show". */
  hasActiveShows: z.boolean(),
})

export const ChannelDirectoryResponseSchema = z.object({
  items: z.array(ChannelDirectoryEntrySchema),
})

export type ChannelDirectoryEntry = z.infer<typeof ChannelDirectoryEntrySchema>

/** Present when the viewer cannot stream; audioUrl / playUrl is null in that case. */
export const PlaybackGateSchema = z
  .object({
    reason: z.enum(['SUBSCRIBERS_ONLY', 'PURCHASE']),
    tierId: z.string().optional(),
  })
  .nullable()

/** Discover → Tahti Selects gallery: the channel's current curated-rotation
 * tracks, for a browsable thumbnail grid (distinct from the raw fallback M3U
 * the internal Liquidsoap route serves). */
export const TahtiSelectsGalleryItemSchema = z.object({
  soundId: z.string(),
  title: z.string(),
  artistName: z.string(),
  artistUsername: z.string().nullable(),
  channelSlug: z.string(),
  bannerUrl: z.string().nullable(),
  durationSec: z.number().int().nullable(),
  audioUrl: z.string().nullable(),
  gate: PlaybackGateSchema.optional(),
})

export const TahtiSelectsGalleryResponseSchema = z.object({
  items: z.array(TahtiSelectsGalleryItemSchema),
})

export type TahtiSelectsGalleryItem = z.infer<typeof TahtiSelectsGalleryItemSchema>

/** Discover → New to you: unheard public tracks filtered by the listener's
 * own follow + listen genre signals (transparent preference match, not a
 * collaborative "for you" ranker). */
export const NewToYouResponseSchema = z.object({
  authenticated: z.boolean(),
  preferenceGenres: z.array(z.string()),
  items: z.array(TahtiSelectsGalleryItemSchema),
})

export type NewToYouResponse = z.infer<typeof NewToYouResponseSchema>
