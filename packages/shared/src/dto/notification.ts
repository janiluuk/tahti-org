// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const NotificationTypeSchema = z.enum([
  'NEW_POST',
  'NEW_MESSAGE',
  'NEW_TRACK',
  'NEW_FOLLOWER',
  'NEW_LIKE',
  'NEW_REPOST',
  'PLAYLIST_TRACK_ADDED',
  'NEW_RELEASE',
  'CHAT_MENTION',
  'RADIO_SUBMISSION_REJECTED',
  'THEME_UNDER_REVIEW',
  'THEME_APPROVED',
  'THEME_REJECTED',
  'ADMIN_TEST',
])

export const NotificationSchema = z.object({
  id: z.string(),
  type: NotificationTypeSchema,
  actor: z
    .object({
      username: z.string(),
      displayName: z.string(),
      avatarUrl: z.string().nullable(),
    })
    .nullable(),
  title: z.string(),
  body: z.string().nullable(),
  url: z.string().nullable(),
  readAt: z.string().datetime().nullable(),
  /** Surfaced in the dashboard's must-dismiss banner instead of the ordinary
   * bell — see StickyNotificationBanner. */
  sticky: z.boolean(),
  createdAt: z.string().datetime(),
})

export type NotificationView = z.infer<typeof NotificationSchema>

export const NotificationListSchema = z.object({
  notifications: z.array(NotificationSchema),
  unreadCount: z.number().int(),
})

// M40: /feed — recent activity from artists the current user follows.
const FeedArtistSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
})

export const FeedItemSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('post'),
    id: z.string(),
    date: z.string().datetime(),
    artist: FeedArtistSchema,
    title: z.string().nullable(),
    body: z.string(),
    images: z.array(z.string()),
    linkUrl: z.string().nullable(),
    linkLabel: z.string().nullable(),
    url: z.string(),
  }),
  z.object({
    kind: z.literal('track'),
    id: z.string(),
    date: z.string().datetime(),
    artist: FeedArtistSchema,
    title: z.string(),
    bannerUrl: z.string().nullable(),
    audioUrl: z.string().nullable(),
    channelSlug: z.string(),
    liked: z.boolean(),
    likeCount: z.number().int(),
    url: z.string(),
  }),
  z.object({
    kind: z.literal('release'),
    id: z.string(),
    date: z.string().datetime(),
    artist: FeedArtistSchema,
    title: z.string(),
    releaseType: z.string(),
    artworkUrl: z.string().nullable(),
    url: z.string(),
  }),
])

export type FeedItem = z.infer<typeof FeedItemSchema>

export const MyFeedResponseSchema = z.object({
  items: z.array(FeedItemSchema),
  followingCount: z.number().int(),
})
