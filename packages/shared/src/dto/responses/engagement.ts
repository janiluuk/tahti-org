// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import { TrackReactionTypeSchema } from '../track-reactions.js'

export const ArtistFollowResponseSchema = z.object({
  following: z.boolean(),
  followerCount: z.number().int(),
})

export const SoundLikeResponseSchema = z.object({
  liked: z.boolean(),
  likeCount: z.number().int(),
})

export const LikedTrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  bannerUrl: z.string().nullable(),
  audioUrl: z.string().nullable(),
  channelSlug: z.string(),
  artistUsername: z.string(),
  artistDisplayName: z.string(),
  likedAt: z.string().datetime(),
  url: z.string(),
  embedProvider: z.string().nullable().optional(),
  embedUri: z.string().nullable().optional(),
})

export const LikedPlaylistResponseSchema = z.object({
  owner: z.object({
    username: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  showLikes: z.boolean(),
  itemCount: z.number().int(),
  coverUrl: z.string().nullable(),
  items: z.array(LikedTrackSchema),
})

export const SoundRepostResponseSchema = z.object({
  reposted: z.boolean(),
  repostCount: z.number().int(),
})

export const TrackReactionItemSchema = z.object({
  id: z.string(),
  type: TrackReactionTypeSchema,
  positionSec: z.number(),
  createdAt: z.coerce.date(),
})

/** M22 tracklist entry — mirrors the shape already stored in Sound.tracklist. */
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
   * scrubbing/playing the sound so the "show" feels alive again. Empty for
   * tracks with no linked broadcast (e.g. uploaded, not recorded live). */
  broadcastReactions: z.array(z.object({ emoji: z.string(), elapsedSec: z.number() })),
})

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

export const RepostAckResponseSchema = z.object({
  acknowledged: z.boolean(),
})
