// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { AvatarThemeSchema, LogoPlacementSchema } from '../avatar-theme.js'
import { ColorSchemeSchema } from '../visual-preset.js'

export const PublicProfileArtistSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  bio: z.string().nullable(),
  /** Optional longer-form history, shown expanded below the short bio. */
  fullBio: z.string().nullable(),
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
  /** True when the artist currently supports Tahti ry (association member). */
  isMember: z.boolean().optional(),
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
      visualPreset: z.string().optional(),
      visualSettingsJson: z.string().nullable().optional(),
      galleryMode: z.string().optional(),
      slideshowImages: z.array(z.string()).optional(),
      headerStyle: z.string().optional(),
      brandAccentPreset: z.string().nullable().optional(),
      colorSchemeJson: z.string().nullable().optional(),
      videoBackgroundUrl: z.string().nullable().optional(),
      textLayerMode: z.string().optional(),
      textLayerText: z.string().optional(),
      textLayerAlign: z.string().optional(),
      slideshowPreset: z.string().optional(),
      slideshowIntervalSeconds: z.number().int().optional(),
      slideshowTransitionMs: z.number().int().optional(),
      slideshowAutoplay: z.boolean().optional(),
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
  purchaseTiers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      priceCents: z.number().int(),
      priceOptional: z.boolean(),
    }),
  ),
  storePaymentsReady: z.boolean(),
  collections: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      type: z.string(),
      style: z.string(),
      description: z.string().nullable(),
      coverUrl: z.string().nullable(),
      /** Extracted-from-cover (or artist-overridden) ambient palette — null
       * when the cover has no extracted colors yet. */
      colorScheme: ColorSchemeSchema.nullable(),
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
      sound: z.string().nullable(),
    }),
    presskit: z.string(),
  }),
  /** Short-lived URL for looping page ambient music (from an assigned clip). */
  backgroundMusicUrl: z.string().url().nullable().optional(),
  likedPlaylist: z
    .object({
      name: z.string(),
      itemCount: z.number().int(),
      coverUrl: z.string().nullable(),
      url: z.string(),
    })
    .nullable()
    .optional(),
})

export const ProfileFieldsSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  bio: z.string().nullable(),
  /** Optional longer-form history, shown expanded below the short bio. */
  fullBio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  avatarPosterUrl: z.string().nullable(),
  avatarTheme: AvatarThemeSchema.nullable(),
  logoUrl: z.string().nullable(),
  logoPlacement: LogoPlacementSchema.nullable(),
  tipJarUrl: z.string().nullable(),
  newsFeedUrl: z.string().nullable(),
  countryCode: z.string().nullable(),
  pronouns: z.string().nullable(),
  defaultLocation: z.string().nullable(),
  socialLinks: z.unknown(),
  publicAttribution: z.boolean(),
  showJoinDate: z.boolean(),
  showFollowers: z.boolean(),
  showFollowing: z.boolean(),
  showDailyListeners: z.boolean(),
  showLikes: z.boolean(),
  chatEnabled: z.boolean(),
  showPageHero: z.boolean(),
  createdAt: z.string().datetime(),
  /** Solo DJ/artist vs collective/band. Defaults to SINGLE when no channel. */
  artistKind: z.enum(['SINGLE', 'COLLECTIVE']),
})
