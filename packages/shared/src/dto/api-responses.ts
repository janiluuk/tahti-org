// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { ColorSchemeSchema } from './visual-preset.js'
import { AvatarThemeSchema, LogoPlacementSchema } from './avatar-theme.js'
import { TrackReactionTypeSchema } from './track-reactions.js'

export const EgressDailyPointSchema = z.object({
  date: z.string(),
  /** Combined download + live HLS bytes for the UTC day. */
  bytes: z.number().int().nonnegative(),
  downloadBytes: z.number().int().nonnegative(),
  /** Measured from Caddy edge logs; 0 when unavailable. */
  liveHlsBytes: z.number().int().nonnegative(),
  estimatedLiveBytes: z.number().int().nonnegative(),
  downloads: z.number().int().nonnegative(),
})

export const ChannelEgressResponseSchema = z.object({
  windowDays: z.number().int().min(1),
  /** downloadBytes + effective live HLS (measured when present, else estimate). */
  totalBytes: z.number().int().nonnegative(),
  downloadBytes: z.number().int().nonnegative(),
  liveHlsBytes: z.number().int().nonnegative(),
  estimatedLiveHlsBytes: z.number().int().nonnegative(),
  totalDownloads: z.number().int().nonnegative(),
  daily: z.array(EgressDailyPointSchema),
  liveEstimateNote: z.string(),
})

export const GateDailyPointSchema = z.object({
  date: z.string(),
  repostAcks: z.number().int().nonnegative(),
  blockedAttempts: z.number().int().nonnegative(),
  countedDownloads: z.number().int().nonnegative(),
})

export const DownloadGateItemStatsSchema = z.object({
  archiveItemId: z.string(),
  title: z.string(),
  repostToDownload: z.boolean(),
  followToDownload: z.boolean(),
  repostAckCount: z.number().int().nonnegative(),
  blockedDownloadAttempts: z.number().int().nonnegative(),
  countedDownloadCount: z.number().int().nonnegative(),
})

export const LiveDailyPointSchema = z.object({
  date: z.string(),
  liveSeconds: z.number().int().nonnegative(),
  broadcastCount: z.number().int().nonnegative(),
  /** Distinct anonymized HLS listeners measured from Caddy access logs; 0 when unavailable. */
  listeners: z.number().int().nonnegative(),
})

export const ChannelLiveStatsResponseSchema = z.object({
  windowDays: z.number().int().min(1),
  totalLiveSeconds: z.number().int().nonnegative(),
  totalBroadcasts: z.number().int().nonnegative(),
  /** Best single-day distinct-listener count across the window. */
  peakDailyListeners: z.number().int().nonnegative(),
  daily: z.array(LiveDailyPointSchema),
})

export const DownloadGateStatsResponseSchema = z.object({
  artistFollowerCount: z.number().int().nonnegative(),
  items: z.array(DownloadGateItemStatsSchema),
  totals: z.object({
    repostAcks: z.number().int().nonnegative(),
    blockedAttempts: z.number().int().nonnegative(),
    countedDownloads: z.number().int().nonnegative(),
  }),
  daily: z.array(GateDailyPointSchema),
})

// PERF-006: egress was dropped from this bundle — it's only ever shown inside the
// overview's collapsed-by-default "Analytics detail" panel, never used for a KPI, yet
// building it means a live Caddy-log read on every dashboard visit. Fetch
// GET /api/me/channel-egress directly if/when that detail is needed.
export const ChannelFunnelResponseSchema = z.object({
  downloadGates: DownloadGateStatsResponseSchema,
  live: ChannelLiveStatsResponseSchema,
})

export const ChannelScheduleViewSchema = z.object({
  nextBroadcastAt: z.string().datetime().nullable(),
  nextBroadcastNote: z.string().nullable(),
})

export const DownloadUrlResponseSchema = z.object({
  url: z.string().url(),
  counted: z.boolean(),
  format: z.string().optional(),
})

export const DownloadGateStatusSchema = z.object({
  repostRequired: z.boolean(),
  followRequired: z.boolean(),
  repostSatisfied: z.boolean(),
  followSatisfied: z.boolean(),
  canDownload: z.boolean(),
})

export type DownloadGateStatus = z.infer<typeof DownloadGateStatusSchema>

export const TransparencyYtdResponseSchema = z.object({
  year: z.string(),
  byCategory: z.record(z.string()),
  runningSurplus: z.string(),
  monthsFinalized: z.number().int().nonnegative(),
})

export const TransparencyLedgerEntrySchema = z.object({
  id: z.string(),
  description: z.string(),
  category: z.string(),
  amountCents: z.string(),
  createdAt: z.string(),
})

export const TransparencyLedgerLatestSchema = z.array(TransparencyLedgerEntrySchema)

export const TransparencyGrantReportSchema = z.object({
  year: z.number().int(),
  totalCents: z.string(),
  grantCount: z.number().int().nonnegative(),
  disbursedAt: z.string().datetime().nullable(),
  grants: z.array(
    z.object({
      publishedAs: z.string(),
      units: z.number(),
      amountCents: z.string(),
      state: z.string(),
    }),
  ),
})

export const DownloadGateItemDetailResponseSchema = z.object({
  repostToDownload: z.boolean(),
  followToDownload: z.boolean(),
  artistFollowerCount: z.number().int().nonnegative(),
  repostAckCount: z.number().int().nonnegative(),
  blockedDownloadAttempts: z.number().int().nonnegative(),
  countedDownloadCount: z.number().int().nonnegative(),
})

export const ApiStatusResponseSchema = z.object({
  status: z.enum(['operational', 'degraded', 'outage']),
  version: z.string(),
  uptimeSec: z.number().int().nonnegative(),
  checks: z.record(
    z.object({
      state: z.string(),
      critical: z.boolean(),
      latencyMs: z.number().optional(),
      detail: z.string().optional(),
    }),
  ),
  ts: z.string().datetime(),
})

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
  /** All-time rotation/archive play-start count. */
  plays: z.number().int(),
  likes: z.number().int(),
  reposts: z.number().int(),
  /** Seconds since the current live broadcast started; null when not live. */
  liveDurationSec: z.number().int().nullable(),
  /** How many archive tracks are flagged for the 24/7 fallback rotation —
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
  /** Set once this library track has been added to rotation (mirrors an ArchiveItem). */
  archiveItemId: z.string().nullable(),
})

export const ChannelProgrammeViewSchema = z.object({
  fallbackMode: z.enum(['shuffle', 'ordered']),
  fallbackEnabled: z.boolean(),
  fallbackAutoEnroll: z.boolean(),
  announcementsEnabled: z.boolean(),
  items: z.array(ChannelProgrammeItemViewSchema),
  library: z.array(ChannelProgrammeLibraryTrackViewSchema),
})

export const StreamSettingsResponseSchema = z.object({
  rtmp: z.object({
    server: z.string(),
    streamKey: z.string(),
    /** STREAM-003: alternate RTMP servers when primary ingest is unreachable. */
    fallbackServers: z.array(z.string()).optional(),
  }),
  icecast: z.object({
    server: z.string(),
    mount: z.string(),
    password: z.string(),
    hint: z.string(),
    fallbackServers: z.array(z.string()).optional(),
  }),
  hlsUrl: z.string(),
})

export const StreamKeyRotateResponseSchema = z.object({
  rtmpStreamKey: z.string(),
})

export const ObsPresetResponseSchema = z.object({
  server: z.string(),
  streamKey: z.string(),
  recommended: z.object({
    audioCodec: z.string(),
    audioBitrateKbps: z.number(),
    sampleRateHz: z.number(),
    channels: z.string(),
    videoCodec: z.string(),
    videoBitrateKbps: z.number(),
    keyframeIntervalSec: z.number(),
    preset: z.string(),
    profile: z.string(),
    tune: z.string(),
  }),
  /** Real OBS scene-collection JSON (Scene Collection → Import) with cover art + title
   * pre-wired — a local-OBS convenience only; does not affect Tahti's own ingest or
   * the YouTube/Twitch multistream mirror (which bakes its own video track server-side). */
  sceneCollection: z.record(z.string(), z.unknown()),
  sceneCollectionFilename: z.string(),
})

export const StreamSignalStatusResponseSchema = z.object({
  connected: z.boolean(),
  codec: z.string().nullable(),
  bitrateKbps: z.number().nullable(),
  listeners: z.number().nullable(),
})

export const IcecastPassRotateResponseSchema = z.object({
  liveSourcePass: z.string(),
})

export const MembershipStatusResponseSchema = z.object({
  status: z.string(),
  isMember: z.boolean(),
  memberNumber: z.number().int().nullable(),
  memberSince: z.coerce.date().nullable(),
  tier: z.string(),
  priceCents: z.number().int(),
  emailVerified: z.boolean(),
  renewalDueAt: z.coerce.date().nullable().optional(),
  hasStripeSubscription: z.boolean().optional(),
  subscriptionMigrationRequired: z.boolean().optional(),
})

export const StripeCheckoutUrlResponseSchema = z.object({
  checkoutUrl: z.string().nullable(),
  sessionId: z.string(),
})

export const MembershipDevActivateResponseSchema = z.object({
  activated: z.literal(true),
  memberNumber: z.number().int(),
  message: z.string(),
})

export const MembershipCheckoutBodySchema = z.object({
  successPath: z.string().max(256).optional(),
  cancelPath: z.string().max(256).optional(),
})

export const MembershipCheckoutResponseSchema = z.union([
  StripeCheckoutUrlResponseSchema,
  MembershipDevActivateResponseSchema,
])

export const BillingPortalUrlResponseSchema = z.object({
  portalUrl: z.string().nullable(),
})

export const FanSubCheckoutUrlResponseSchema = z.object({
  checkoutUrl: z.string().nullable(),
  sessionId: z.string(),
})

export const FanSubActivatedResponseSchema = z.object({
  activated: z.literal(true),
  subscriptionId: z.string(),
  tierName: z.string(),
  amountCents: z.number().int(),
  currentPeriodEnd: z.coerce.date(),
})

export const FanSubSubscriptionViewSchema = z.object({
  id: z.string(),
  tierName: z.string(),
  amountCents: z.number().int(),
  state: z.string(),
  currentPeriodEnd: z.coerce.date(),
  canceledAt: z.coerce.date().nullable(),
  artist: z.object({
    username: z.string(),
    displayName: z.string(),
  }),
})

export const FanSubSubscriptionListSchema = z.array(FanSubSubscriptionViewSchema)

export const FanSubCancelResponseSchema = z.object({
  id: z.string(),
  state: z.string(),
  canceledAt: z.coerce.date().nullable(),
  currentPeriodEnd: z.coerce.date(),
  accessUntil: z.coerce.date(),
  message: z.string(),
})

export const FanConnectStatusResponseSchema = z.object({
  stripeConfigured: z.boolean(),
  accountId: z.string().nullable(),
  chargesEnabled: z.boolean(),
  detailsSubmitted: z.boolean(),
  paymentsReady: z.boolean(),
})

export const FanConnectOnboardResponseSchema = z.object({
  onboardingUrl: z.string().url(),
  accountId: z.string(),
})

export const VenueBroadcastCalendarSchema = z.object({
  venue: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  }),
  broadcasts: z.array(z.unknown()),
})

export const VenueDirectoryEntrySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  city: z.string(),
  countryCode: z.string().nullable(),
  capacity: z.number().int().nullable(),
  description: z.string().nullable(),
})

export const VenueDirectoryListSchema = z.array(VenueDirectoryEntrySchema)

export const VenuePublicProfileSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    broadcasts: z.array(z.unknown()),
  })
  .passthrough()

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
  chatEnabled: z.boolean().optional(),
})

export const PublicChannelViewSchema = z.object({
  slug: z.string(),
  state: z.string(),
  hlsUrl: z.string().nullable(),
  nextBroadcastAt: z.string().datetime().nullable(),
  nextBroadcastNote: z.string().nullable(),
  galleryMode: z.string(),
  slideshowImages: z.array(z.string()),
  textLayerMode: z.string(),
  textLayerText: z.string(),
  textLayerAlign: z.string(),
  videoBackgroundUrl: z.string().nullable(),
  // M31
  colorSchemeJson: z.string().nullable(),
  colorScheme: ColorSchemeSchema,
  visualPreset: z.string(),
  slideshowPreset: z.string(),
  slideshowIntervalSeconds: z.number().int(),
  slideshowTransitionMs: z.number().int(),
  slideshowAutoplay: z.boolean(),
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

export const GrantAnomalySchema = z.object({
  code: z.enum(['DOMINANT_IP', 'HIGH_UNIT_SHARE', 'ANONYMOUS_GRANT']),
  message: z.string(),
})

export const GrantPreviewArtistSchema = z.object({
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
  publicAttribution: z.boolean(),
  units: z.number(),
  amountCents: z.number().int(),
  freeDownloads: z.number().int(),
  paidDownloads: z.number().int(),
  fanSubEuros: z.number().int(),
  anomalies: z.array(GrantAnomalySchema),
})

export const GrantPreviewResponseSchema = z.object({
  forYear: z.number().int(),
  alreadyRun: z.boolean(),
  surplusCents: z.number().int(),
  reserveCents: z.number().int(),
  poolCents: z.number().int(),
  totalUnits: z.number(),
  grantCount: z.number().int(),
  unallocatedCents: z.number().int(),
  artists: z.array(GrantPreviewArtistSchema),
})

/** POST /api/admin/grants/run/:year — same summary fields as preview, without artist rows. */
export const GrantRunResponseSchema = GrantPreviewResponseSchema.omit({ artists: true })

export const ArtistFollowResponseSchema = z.object({
  following: z.boolean(),
  followerCount: z.number().int(),
})

export const ArchiveItemLikeResponseSchema = z.object({
  liked: z.boolean(),
  likeCount: z.number().int(),
})

export const ArchiveItemRepostResponseSchema = z.object({
  reposted: z.boolean(),
  repostCount: z.number().int(),
})

export const TrackReactionItemSchema = z.object({
  id: z.string(),
  type: TrackReactionTypeSchema,
  positionSec: z.number(),
  createdAt: z.coerce.date(),
})

/** M22 tracklist entry — mirrors the shape already stored in ArchiveItem.tracklist. */
export const TrackTracklistEntrySchema = z.object({
  startSec: z.number(),
  title: z.string(),
  artist: z.string().nullable().optional(),
})

/** GET /api/reactions/track/:id — the full player's single fetch for "now playing"
 * detail: waveform peaks, reaction markers, and the identity/tracklist info shown
 * in fullscreen cinema mode (show name = title, identity = artist + avatar). */
export const TrackPlaybackDetailsSchema = z.object({
  title: z.string(),
  artistName: z.string(),
  artistAvatarUrl: z.string().nullable(),
  channelSlug: z.string(),
  tracklist: z.array(TrackTracklistEntrySchema).nullable(),
  peaks: z.array(z.number()).nullable(),
  reactions: z.array(TrackReactionItemSchema),
  /** Flying-emoji reactions fired live during the original broadcast, if this
   * track was recorded from one — replayed at the matching elapsedSec while
   * scrubbing/playing the archive so the "show" feels alive again. Empty for
   * tracks with no linked broadcast (e.g. uploaded, not recorded live). */
  broadcastReactions: z.array(z.object({ emoji: z.string(), elapsedSec: z.number() })),
})

export const ChannelCardSchema = z.object({
  slug: z.string(),
  state: z.string(),
  goneLiveAt: z.string().datetime().nullable(),
  nextBroadcastAt: z.string().datetime().nullable(),
  nextBroadcastNote: z.string().nullable(),
  genres: z.array(z.string()),
  /** Channel is actively airing its 24/7 archive rotation right now (not
   * live) — shown as "REPLAY" on the Discover page, same convention as the
   * mini-player's REPLAY badge for Tahti Radio's own rotation. */
  fallbackEnabled: z.boolean(),
  user: PublicChannelUserSchema,
})

export const ChannelListResponseSchema = z.object({
  live: z.array(ChannelCardSchema),
  /** Not live, but currently airing their archive rotation (fallbackEnabled) — REPLAY. */
  replaying: z.array(ChannelCardSchema),
  recent: z.array(ChannelCardSchema),
})

export type ChannelCard = z.infer<typeof ChannelCardSchema>
export type ChannelListResponse = z.infer<typeof ChannelListResponseSchema>

/** Discover → "Artists" tab: every channel with a public archive item, not just
 * currently live/recent ones. */
export const ChannelDirectoryEntrySchema = z.object({
  slug: z.string(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  genres: z.array(z.string()),
})

export const ChannelDirectoryResponseSchema = z.object({
  items: z.array(ChannelDirectoryEntrySchema),
})

export type ChannelDirectoryEntry = z.infer<typeof ChannelDirectoryEntrySchema>

/** Discover → Tahti Selects gallery: the channel's current curated-rotation
 * tracks, for a browsable thumbnail grid (distinct from the raw fallback M3U
 * the internal Liquidsoap route serves). */
export const TahtiSelectsGalleryItemSchema = z.object({
  archiveItemId: z.string(),
  title: z.string(),
  artistName: z.string(),
  artistUsername: z.string().nullable(),
  channelSlug: z.string(),
  bannerUrl: z.string().nullable(),
  durationSec: z.number().int().nullable(),
  audioUrl: z.string().nullable(),
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

export const TransparencyMonthlyRollupSchema = z.object({
  yearMonth: z.string(),
  byCategory: z.record(z.unknown()),
  surplus: z.string(),
  finalizedAt: z.string().datetime().nullable(),
})

export const TransparencyMonthlyRollupListSchema = z.array(TransparencyMonthlyRollupSchema)

export const TransparencyCategoriesResponseSchema = z.object({
  revenue: z.array(z.object({ code: z.string(), label: z.string() })),
  costs: z.array(z.object({ code: z.string(), label: z.string() })),
  disbursements: z.array(z.object({ code: z.string(), label: z.string() })),
})

export const ArchiveItemViewSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
    effectiveBpm: z.number().nullable().optional(),
    effectiveKey: z.string().nullable().optional(),
    sourceFormat: z.string().nullable().optional(),
    sourceBitrateKbps: z.number().int().nullable().optional(),
  })
  .passthrough()

export const ArchiveItemListSchema = z.array(ArchiveItemViewSchema)

// PERF-006: dashboard overview only ever shows the 1-2 most recent items — no need to
// pull the full 100-item, full-metadata payload GET /api/me/archive returns.
export const ArchiveItemRecentSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    durationSec: z.number().int().nullable(),
    createdAt: z.string(),
  }),
)

/** Public channel archive list (includes presigned audioUrl and full metadata). */
export const ChannelArchiveItemsResponseSchema = z.array(z.record(z.string(), z.unknown()))

/** One row in a profile's followers/following list modal. */
export const ArtistFollowUserSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
})
export const ArtistFollowListResponseSchema = z.object({
  users: z.array(ArtistFollowUserSchema),
  hasMore: z.boolean(),
})

export const PublicProfileArtistSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  /** Static poster frame — present only when avatarUrl is an animated GIF. */
  avatarPosterUrl: z.string().nullable().optional(),
  /** Solid / gradient fill for avatar + cover. */
  avatarTheme: AvatarThemeSchema.nullable().optional(),
  /** Alpha logo URL — placement controls where it prints. */
  logoUrl: z.string().nullable().optional(),
  logoPlacement: LogoPlacementSchema.nullable().optional(),
  socialLinks: z.unknown(),
  tipJarUrl: z.string().nullable(),
  tier: z.string(),
  countryCode: z.string().nullable().optional(),
  pronouns: z.string().nullable().optional(),
  joinDate: z.string().datetime().nullable().optional(),
  /** Null when the artist has hidden their followers/following list from their profile. */
  followerCount: z.number().int().nullable().optional(),
  followingCount: z.number().int().nullable().optional(),
})

export const PublicProfileViewSchema = z.object({
  artist: PublicProfileArtistSchema,
  channel: z
    .object({
      slug: z.string(),
      state: z.string(),
      artistKind: z.enum(['SINGLE', 'COLLECTIVE']).optional(),
    })
    .nullable(),
  releases: z.array(z.record(z.string(), z.unknown())),
  tracks: z.array(z.record(z.string(), z.unknown())),
  fanTiers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      amountCents: z.number().int(),
    }),
  ),
  collections: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      type: z.string(),
      style: z.string(),
      description: z.string().nullable(),
      coverUrl: z.string().nullable(),
      isFeatured: z.boolean(),
      itemCount: z.number().int(),
      url: z.string(),
      rssUrl: z.string(),
    }),
  ),
  links: z.object({
    channel: z.string().nullable(),
    subscribe: z.string(),
    feeds: z.object({
      archive: z.string().nullable(),
    }),
    presskit: z.string(),
  }),
  /** Short-lived URL for looping page ambient music (from an assigned clip). */
  backgroundMusicUrl: z.string().url().nullable().optional(),
})

export const SmartLinkViewSchema = z.object({
  release: z.record(z.string(), z.unknown()),
  artist: z.object({
    username: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  featuredCollections: z.array(z.record(z.string(), z.unknown())),
  profileUrl: z.string(),
  releaseUrl: z.string(),
  targets: z.record(z.string()),
  embedUrl: z.string(),
})

export const FanTierPublicSchema = z.object({
  id: z.string(),
  name: z.string(),
  amountCents: z.number().int(),
  description: z.string().nullable(),
  perks: z.array(z.string()),
})

export const FanTiersPublicResponseSchema = z.object({
  artist: z.object({
    id: z.string(),
    displayName: z.string(),
    username: z.string(),
    bio: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  }),
  tiers: z.array(FanTierPublicSchema),
  paymentsReady: z.boolean(),
})

export const GovernanceMemberViewSchema = z.object({
  memberNumber: z.number().int().nullable(),
  displayName: z.string(),
  username: z.string(),
  memberSince: z.coerce.date().nullable(),
  isBoard: z.boolean(),
  channelSlug: z.string().nullable(),
})

export const GovernanceMemberListSchema = z.array(GovernanceMemberViewSchema)

/** Board-only PRH register preview (includes email; use export.csv for official file). */
export const AdminMemberRegisterRowSchema = z.object({
  memberNumber: z.number().int().nullable(),
  displayName: z.string(),
  email: z.string().email(),
  username: z.string(),
  memberSince: z.coerce.date().nullable(),
  membershipStatus: z.string().nullable(),
})

export const AdminMemberRegisterListSchema = z.array(AdminMemberRegisterRowSchema)

export const MotionVoteTallySchema = z.object({
  YES: z.number().int(),
  NO: z.number().int(),
  ABSTAIN: z.number().int(),
})

export const MotionSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  state: z.string(),
  advisory: z.boolean(),
  openAt: z.coerce.date(),
  closeAt: z.coerce.date(),
  proposer: z.string(),
  totalVotes: z.number().int(),
  youVoted: z.boolean(),
  yourChoice: z.string().nullable(),
  commentCount: z.number().int(),
  // Only present once CLOSED (hidden while OPEN to avoid a bandwagon effect —
  // see comment in apps/api/src/routes/governance/index.ts). Included in the
  // list response, not just the detail one, since the governance page has no
  // per-motion detail fetch and this is the only place a closed motion's
  // result is shown.
  tally: MotionVoteTallySchema.optional(),
})

export const MotionListSchema = z.array(MotionSummarySchema)

export const MotionDetailSchema = MotionSummarySchema.extend({
  description: z.string(),
})

export const MotionCommentSchema = z.object({
  id: z.string(),
  body: z.string(),
  authorId: z.string().nullable(),
  authorDisplayName: z.string().nullable(),
  createdAt: z.coerce.date(),
})

export const MotionCommentListSchema = z.array(MotionCommentSchema)

export const CollectionPublicViewSchema = z
  .object({
    slug: z.string(),
    name: z.string(),
    isPublic: z.boolean(),
    collaborative: z.boolean(),
    user: z.object({
      username: z.string(),
      displayName: z.string(),
    }),
    links: z.object({
      page: z.string(),
      rss: z.string(),
    }),
  })
  .passthrough()

/** One result row in the public catalog track search (used by the
 * collaborative-playlist "Add track" picker). */
export const CatalogTrackSearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  durationSec: z.number().int().nullable(),
  artistName: z.string(),
  channelSlug: z.string(),
})
export const CatalogTrackSearchResponseSchema = z.object({
  tracks: z.array(CatalogTrackSearchResultSchema),
  hasMore: z.boolean(),
})

export const PrepareUploadResponseSchema = z.object({
  uploadId: z.string(),
  uploadUrl: z.string().url(),
  expiresAt: z.string(),
  title: z.string(),
})

export const CompleteUploadResponseSchema = z.object({
  itemId: z.string(),
  status: z.string(),
})

export const AuthMeResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  tier: z.string(),
  emailVerifiedAt: z.coerce.date().nullable(),
  isMember: z.boolean(),
  isBoard: z.boolean(),
  membership: z
    .object({
      status: z.string(),
      activatedAt: z.coerce.date().nullable(),
    })
    .nullable(),
  channel: z
    .object({
      slug: z.string(),
      state: z.string(),
      goneLiveAt: z.coerce.date().nullable(),
      customDomain: z.string().nullable(),
      customDomainVerified: z.boolean(),
    })
    .nullable(),
  storage: z.object({
    usedBytes: z.string(),
    /** Soft target for free-tier nudges only; omitted for members. */
    softTargetBytes: z.string().optional(),
    showSoftTarget: z.boolean(),
  }),
})

export const ProfileFieldsSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  avatarPosterUrl: z.string().nullable(),
  avatarTheme: AvatarThemeSchema.nullable(),
  logoUrl: z.string().nullable(),
  logoPlacement: LogoPlacementSchema.nullable(),
  tipJarUrl: z.string().nullable(),
  countryCode: z.string().nullable(),
  pronouns: z.string().nullable(),
  defaultLocation: z.string().nullable(),
  socialLinks: z.unknown(),
  publicAttribution: z.boolean(),
  showJoinDate: z.boolean(),
  showFollowers: z.boolean(),
  showFollowing: z.boolean(),
  showDailyListeners: z.boolean(),
  chatEnabled: z.boolean(),
  createdAt: z.string().datetime(),
  /** Solo DJ/artist vs collective/band. Defaults to SINGLE when no channel. */
  artistKind: z.enum(['SINGLE', 'COLLECTIVE']),
})

export const MetaStreamOptResponseSchema = z.object({
  metaStreamOptOut: z.boolean(),
})

export const NewsletterSubscriberStatsSchema = z.object({
  total: z.number().int(),
  confirmed: z.number().int(),
  newLast30Days: z.number().int(),
  /** Of `confirmed`, how many also hold an active fan-sub tier with the FAN_NEWSLETTER perk. */
  fanSubscriberCount: z.number().int(),
})

export const NewsletterSubscribeStatusSchema = z.object({
  status: z.string(),
})

/** Logged-in viewer's subscription state to a specific artist's newsletter. */
export const NewsletterMySubscriptionSchema = z.object({
  subscribed: z.boolean(),
})

export const RepostAckResponseSchema = z.object({
  acknowledged: z.boolean(),
})

export const NewsletterDraftSummarySchema = z.object({
  id: z.string(),
  subject: z.string(),
  state: z.string(),
  sentAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  subscribersOnly: z.boolean(),
  _count: z.object({ sends: z.number().int() }),
})

export const NewsletterDraftListSchema = z.array(NewsletterDraftSummarySchema)

// PERF-008: was a fully unbounded findMany.
export const NewsletterDraftListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
})

export const NewsletterDraftPagedListSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  drafts: NewsletterDraftListSchema,
})

export const NewsletterDraftViewSchema = NewsletterDraftSummarySchema.extend({
  bodyMd: z.string(),
  updatedAt: z.coerce.date().optional(),
}).passthrough()

export const BroadcastUsageResponseSchema = z.object({
  tier: z.string(),
  unlimited: z.boolean(),
  weeklyCapSeconds: z.number().int(),
  graceSeconds: z.number().int(),
  secondsUsed: z.number().int(),
  secondsRemaining: z.number().int(),
  warnings: z.array(z.string()),
  warningLevel: z.enum(['none', '45m', '55m', 'grace', 'blocked']),
  inGrace: z.boolean(),
  atCap: z.boolean(),
  blocked: z.boolean(),
  showUpgradeCta: z.boolean(),
})

export const AuthUserSummarySchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  displayName: z.string(),
  tier: z.string(),
})

export const AuthLoginResponseSchema = z.object({
  user: AuthUserSummarySchema.optional(),
  requiresTotp: z.boolean().optional(),
  challengeId: z.string().optional(),
})

export const TotpStatusResponseSchema = z.object({
  enabled: z.boolean(),
})

export const TotpSetupResponseSchema = z.object({
  secret: z.string(),
  otpauthUri: z.string(),
})

export const TotpConfirmResponseSchema = z.object({
  backupCodes: z.array(z.string()),
})

export const AuthRegisterResponseSchema = z.object({
  message: z.string(),
  userId: z.string(),
})

export const AuthMessageResponseSchema = z.object({
  message: z.string(),
})

export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'error']),
  db: z.enum(['ok', 'error']),
  checks: z.record(z.string()),
  uptime: z.number().int().nonnegative(),
  ts: z.string().datetime(),
})

export const ChatTokenResponseSchema = z.object({
  token: z.string(),
  handle: z.string(),
  fingerprint: z.string(),
  supporter: z.boolean(),
  countryCode: z.string().nullable(),
  channelRole: z.enum(['owner', 'moderator']).nullable(),
})

export const ChatTokenOnlyResponseSchema = z.object({
  token: z.string(),
})

export const ChatOkResponseSchema = z.object({
  ok: z.literal(true),
})

export const ChatPresenceResponseSchema = z.object({
  numClients: z.number().int().nonnegative(),
})

export const ChatDailyListenersResponseSchema = z.object({
  count: z.number().int().nonnegative(),
  /** False when the artist has turned this off in their settings — the
   * count itself is still computed above but callers should not display it. */
  enabled: z.boolean(),
})

export const ChatHistoryMessageSchema = z.object({
  handle: z.string(),
  text: z.string(),
  ts: z.number(),
  supporter: z.boolean().optional(),
  channelRole: z.enum(['owner', 'moderator']).nullable().optional(),
  countryCode: z.string().nullable().optional(),
  system: z.boolean().optional(),
  href: z.string().optional(),
})

export const ChatHistoryResponseSchema = z.object({
  messages: z.array(ChatHistoryMessageSchema),
})

export const ChatAnnouncementViewSchema = z.object({
  id: z.string(),
  body: z.string(),
  createdAt: z.coerce.date(),
})

export const ChatAnnouncementListSchema = z.array(ChatAnnouncementViewSchema)

export const ChannelModeratorViewSchema = z.object({
  userId: z.string(),
  username: z.string(),
  displayName: z.string(),
  grantedAt: z.coerce.date(),
})

export const ChannelModeratorListSchema = z.array(ChannelModeratorViewSchema)

export const ModeratedChannelViewSchema = z.object({
  slug: z.string(),
  displayName: z.string(),
  isOwner: z.boolean(),
})

export const ModeratedChannelListSchema = z.array(ModeratedChannelViewSchema)

export const ChatBanViewSchema = z.object({
  fingerprintHash: z.string(),
  bannedAt: z.coerce.date(),
})

export const ChatBanListSchema = z.array(ChatBanViewSchema)

export const MotionRefResponseSchema = z.object({
  id: z.string(),
  state: z.string(),
})

export const VoteCastResponseSchema = z.object({
  ok: z.literal(true),
  choice: z.string(),
})

export const LedgerEntryCreatedSchema = z.object({
  id: z.string(),
  category: z.string(),
  amountCents: z.string(),
})

export const LedgerEntryViewSchema = z
  .object({
    id: z.string(),
    category: z.string(),
    amountCents: z.string(),
    currency: z.string(),
    description: z.string(),
    createdAt: z.coerce.date(),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
  })
  .passthrough()

export const LedgerEntryListSchema = z.array(LedgerEntryViewSchema)

const meReleaseRow = z.object({ id: z.string(), title: z.string() }).passthrough()

export const MeReleaseListSchema = z.array(meReleaseRow)

// PERF-008: was a fully unbounded findMany. page/limit default to today's
// effective behavior (everything, up to a safety cap) rather than forcing a
// "load more" UI on a list that's realistically small per artist.
export const MeReleaseListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
})

export const MeReleasePagedListSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  releases: MeReleaseListSchema,
})

export const MeReleaseDetailSchema = meReleaseRow

export const ReleaseChecklistStepSchema = z.object({
  id: z.string(),
  label: z.string(),
  done: z.boolean(),
  hint: z.string().optional(),
})

export const ReleaseCatalogViewSchema = z
  .object({
    id: z.string(),
    checklist: z.array(ReleaseChecklistStepSchema),
  })
  .passthrough()

export const RtmpTargetViewSchema = z.object({
  id: z.string(),
  provider: z.string(),
  label: z.string(),
  rtmpUrl: z.string(),
  alwaysMirror: z.boolean(),
  enabled: z.boolean(),
  createdAt: z.coerce.date().optional(),
  /** Last 4 characters of the stream key — for "key ••••••{last4}" display. Full key is never listed. */
  keyLast4: z.string().optional(),
})

export const RtmpTargetListSchema = z.array(RtmpTargetViewSchema)

export const RtmpStreamKeyRevealSchema = z.object({
  streamKey: z.string(),
})

/** Manage tab multistream status row — 'disabled' means the target exists but
 * is toggled off; 'offline' means enabled but the channel isn't currently
 * running Liquidsoap at all; 'connected'/'error' come from a live docker-logs
 * scan (see getRtmpTargetStatuses in the orchestrator). */
export const RtmpTargetStatusSchema = z.enum(['connected', 'error', 'offline', 'disabled'])

export const RtmpTargetStatusViewSchema = z.object({
  id: z.string(),
  provider: z.string(),
  label: z.string(),
  enabled: z.boolean(),
  status: RtmpTargetStatusSchema,
  lastError: z.string().optional(),
})

export const RtmpTargetStatusListSchema = z.array(RtmpTargetStatusViewSchema)

export const FanSubPayoutsDashboardSchema = z.object({
  pending: z.number().int(),
  failed: z.number().int(),
  paidLast30Days: z.number().int(),
  activeSubscribers: z.number().int(),
  thisMonthNetCents: z.number().int(),
  paidYtdNetCents: z.number().int(),
  recent: z.array(
    z.object({
      id: z.string(),
      state: z.string(),
      tierName: z.string(),
      grossCents: z.number().int(),
      netToArtistCents: z.number().int(),
      forPeriodStart: z.coerce.date(),
      forPeriodEnd: z.coerce.date(),
      paidAt: z.coerce.date().nullable(),
      createdAt: z.coerce.date(),
    }),
  ),
})

// PERF-006: dashboard overview only ever reads thisMonthNetCents for a single KPI —
// avoids the 7-query FanSubPayoutsDashboardSchema payload's counts/aggregates/recent list.
export const FanSubPayoutsSummarySchema = z.object({
  thisMonthNetCents: z.number().int(),
})

export const MeGrantDisbursementSchema = z.object({
  forYear: z.number().int(),
  units: z.number(),
  amountCents: z.string(),
  state: z.string(),
  notifiedAt: z.coerce.date().nullable(),
  confirmedAt: z.coerce.date().nullable(),
  paidAt: z.coerce.date().nullable(),
})

export const MeGrantListSchema = z.array(MeGrantDisbursementSchema)

/** Forecast of this artist's share of the current year's grant pool, based
 *  on engagement units accrued so far and the year-to-date surplus. */
export const MeGrantEstimateSchema = z.object({
  year: z.number().int(),
  estimateCents: z.number().int().nonnegative(),
  units: z.number().nonnegative(),
  eligible: z.boolean(),
  freeDownloads: z.number().int().nonnegative(),
  paidDownloads: z.number().int().nonnegative(),
  fanSubEuros: z.number().int().nonnegative(),
})

export const FanConnectPortalResponseSchema = z.object({
  url: z.string().url(),
})

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
    }),
  ),
})

export const AdminVenueBoardSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  city: z.string(),
  countryCode: z.string(),
  verifiedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  createdBy: z.string(),
})

export const AdminVenueListSchema = z.array(AdminVenueBoardSchema)

export const AdminVenueUpdatedSchema = AdminVenueBoardSchema.passthrough()

export const AdminMemberStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  newThisMonth: z.number().int().nonnegative(),
  lapsedThisMonth: z.number().int().nonnegative(),
})

export const AdminQueueStatsSchema = z.object({
  name: z.string(),
  waiting: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  delayed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
})

export const AdminQueueStatsListSchema = z.array(AdminQueueStatsSchema)

export const AdminSystemHealthSchema = z.object({
  icecast: z.enum(['up', 'down']),
  minio: z.enum(['up', 'down']),
  postgresBackupAgeHours: z.number().nullable(),
  failedFanSubPayouts: z.number().int().nonnegative(),
})

export const AdminCronRunEntrySchema = z.object({
  id: z.string(),
  startedAt: z.coerce.date(),
  finishedAt: z.coerce.date().nullable(),
  outcome: z.string().nullable(),
  errorMessage: z.string().nullable(),
})

export const AdminCronJobStatusSchema = z.object({
  jobName: z.string(),
  description: z.string(),
  pattern: z.string(),
  lastRun: AdminCronRunEntrySchema.nullable(),
})

export const AdminCronRunListSchema = z.array(AdminCronJobStatusSchema)

export const AdminAuditRecentItemSchema = z.object({
  id: z.string(),
  action: z.string(),
  actorId: z.string(),
  targetId: z.string().nullable(),
  createdAt: z.coerce.date(),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const AdminAuditRecentListSchema = z.array(AdminAuditRecentItemSchema)

export const AdminLiveStreamSchema = z.object({
  channelId: z.string(),
  slug: z.string(),
  artistName: z.string(),
  username: z.string(),
  goneLiveAt: z.coerce.date().nullable(),
  elapsedSec: z.number().int().nonnegative(),
  hlsUrl: z.string().url().nullable(),
  /** True when this channel uses the curated-rotation Liquidsoap template. */
  isRotation: z.boolean(),
})

export const AdminLiveStreamListSchema = z.object({
  count: z.number().int().nonnegative(),
  streams: z.array(AdminLiveStreamSchema),
})

export const AdminUserListItemSchema = z.object({
  id: z.string(),
  memberNumber: z.number().int().nullable(),
  displayName: z.string(),
  email: z.string(),
  username: z.string(),
  tier: z.string(),
  isMember: z.boolean(),
  isBoard: z.boolean(),
  suspendedAt: z.coerce.date().nullable(),
  channelState: z.string().nullable(),
  memberSince: z.coerce.date().nullable(),
  engagementUnitsYtd: z.number().int().nonnegative(),
  /** R2 long-term storage usage (release track originals), rounded to whole MB. */
  storageUsedMB: z.number().nonnegative(),
})

export const AdminUserListResponseSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  users: z.array(AdminUserListItemSchema),
})

export const AdminUserDetailSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    username: z.string(),
    displayName: z.string(),
    tier: z.string(),
    isMember: z.boolean(),
    isBoard: z.boolean(),
    memberNumber: z.number().int().nullable(),
    memberSince: z.coerce.date().nullable(),
    suspendedAt: z.coerce.date().nullable(),
    suspendReason: z.string().nullable(),
    engagementUnitsYtd: z.number().int(),
    channel: z.unknown().nullable(),
    fanSubscriptionsAsArtist: z.number().int(),
    stripeConnectChargesEnabled: z.boolean(),
  })
  .passthrough()

export const MentionsEnabledResponseSchema = z.object({
  mentionsEnabled: z.boolean(),
  publicMentionsEnabled: z.boolean(),
})

export const PublicMentionItemSchema = z.object({
  id: z.string(),
  surface: z.string(),
  createdAt: z.coerce.date(),
  mentioner: z.object({
    username: z.string(),
    displayName: z.string(),
  }),
})

export const PublicMentionListSchema = z.array(PublicMentionItemSchema)

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

export const MentionMutedResponseSchema = z.object({
  muted: z.string(),
})

export const MentionUnmutedResponseSchema = z.object({
  unmuted: z.string(),
})

export const UserSearchHitSchema = z.object({
  username: z.string(),
  displayName: z.string(),
})

export const UserSearchListSchema = z.array(UserSearchHitSchema)

export const ReleaseTrackViewSchema = z
  .object({
    id: z.string(),
    releaseId: z.string(),
    position: z.number().int(),
    title: z.string(),
    status: z.string(),
  })
  .passthrough()

export const ReleaseTrackUploadUrlSchema = z.object({
  uploadUrl: z.string().url(),
  sourceKey: z.string(),
  expiresAt: z.string(),
})

export const ReleaseTrackFinalizeSchema = z.object({
  trackId: z.string(),
  status: z.literal('scanning'),
})

export const ReleaseTrackDownloadUrlSchema = z.object({
  url: z.string().url(),
  format: z.enum(['flac', 'opus']),
  expiresInSec: z.number().int(),
})

export const ChatAccessResponseSchema = z.object({
  fanChatEnabled: z.boolean(),
  isSupporter: z.boolean(),
  canJoinFanChat: z.boolean(),
  subscribersOnly: z.boolean(),
  canPostInChat: z.boolean(),
})

export const ChatFanTokenResponseSchema = z.object({
  token: z.string(),
  handle: z.string(),
  channel: z.string(),
  supporter: z.literal(true),
})

export const ChatPublishAckSchema = z.object({
  result: z.object({}).passthrough(),
})

export const StripeWebhookAckSchema = z.object({
  received: z.boolean(),
})

export const StripeWebhookErrorSchema = z.object({
  error: z.string(),
  received: z.boolean().optional(),
})

export const CsvExportBodySchema = z.string()

export const PrometheusMetricsBodySchema = z.string()

export const FallbackM3uBodySchema = z.string()

export const PlainTextErrorSchema = z.string()
