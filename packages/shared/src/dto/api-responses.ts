// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { ColorSchemeSchema } from './visual-preset.js'

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

export const ChannelProgrammeItemViewSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  durationSec: z.number().nullable(),
  isFallback: z.boolean(),
  fallbackOrder: z.number().int().nullable(),
  lastFallbackPlayedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
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
  countryCode: z.string().nullable().optional(),
  pronouns: z.string().nullable().optional(),
  socialLinks: z.unknown().optional(),
  joinDate: z.string().datetime().nullable().optional(),
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
})

export const ChannelCardSchema = z.object({
  slug: z.string(),
  state: z.string(),
  goneLiveAt: z.string().datetime().nullable(),
  nextBroadcastAt: z.string().datetime().nullable(),
  nextBroadcastNote: z.string().nullable(),
  genres: z.array(z.string()),
  user: PublicChannelUserSchema,
})

export const ChannelListResponseSchema = z.object({
  live: z.array(ChannelCardSchema),
  recent: z.array(ChannelCardSchema),
})

export type ChannelCard = z.infer<typeof ChannelCardSchema>
export type ChannelListResponse = z.infer<typeof ChannelListResponseSchema>

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

export const PublicProfileArtistSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  socialLinks: z.unknown(),
  tipJarUrl: z.string().nullable(),
  tier: z.string(),
  countryCode: z.string().nullable().optional(),
  pronouns: z.string().nullable().optional(),
  joinDate: z.string().datetime().nullable().optional(),
})

export const PublicProfileViewSchema = z.object({
  artist: PublicProfileArtistSchema,
  channel: z
    .object({
      slug: z.string(),
      state: z.string(),
    })
    .nullable(),
  releases: z.array(z.record(z.string(), z.unknown())),
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
  }),
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
  tipJarUrl: z.string().nullable(),
  countryCode: z.string().nullable(),
  pronouns: z.string().nullable(),
  socialLinks: z.unknown(),
  publicAttribution: z.boolean(),
  showJoinDate: z.boolean(),
  createdAt: z.string().datetime(),
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
  user: AuthUserSummarySchema,
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
})

export const AdminAuditRecentListSchema = z.array(AdminAuditRecentItemSchema)

export const AdminLiveStreamSchema = z.object({
  channelId: z.string(),
  slug: z.string(),
  artistName: z.string(),
  username: z.string(),
  goneLiveAt: z.coerce.date().nullable(),
  elapsedSec: z.number().int().nonnegative(),
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
