// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import type { NotificationTypeSchema } from './notification.js'

type NotificationType = z.infer<typeof NotificationTypeSchema>

/** Groups of notification types the inbox can be filtered by. Anything not
 * listed here (support, board and newer types) falls under `other`. */
export const NOTIFICATION_KIND_TYPES = {
  social: [
    'NEW_FOLLOWER',
    'NEW_LIKE',
    'NEW_REPOST',
    'NEW_COMMENT',
    'NEW_MESSAGE',
    'CHAT_MENTION',
    'PLAYLIST_TRACK_ADDED',
    'MODERATOR_ADDED',
    'TRACK_SHARED',
    'GREEN_ROOM_INVITE',
  ],
  music: [
    'NEW_POST',
    'NEW_TRACK',
    'NEW_RELEASE',
    'NEW_EVENT',
    'CHANNEL_LIVE',
    'STREAMING_COPY_READY',
    'RADIO_SUBMISSION_REJECTED',
    'RADIO_SUBMISSION_ACCEPTED',
    'RADIO_STATION_REVIEWED',
    'TRACK_EDITED_BY_BOARD',
    'CHANNEL_FORCED_OFFLINE',
    'VENUE_VERIFIED',
    'VENUE_SHOW_BOOKED',
    'VENUE_SHOW_CANCELED',
    'TAHTI_SELECTS_PICK',
    'TAHTI_RADIO_INCLUSION_CHANGED',
    'BACKGROUND_JOB_DONE',
    'BACKGROUND_JOB_FAILED',
    'THEME_UNDER_REVIEW',
    'THEME_APPROVED',
    'THEME_REJECTED',
  ],
  money: [
    'NEW_FAN_SUBSCRIBER',
    'NEW_PURCHASE',
    'PAYOUT_SENT',
    'FAN_SUB_PAYMENT_FAILED',
    'FAN_SUB_EXPIRED',
    'FAN_SUB_CANCELED',
    'GRANT_AWARDED',
    'MEMBERSHIP_ENDED',
  ],
  governance: [
    'MOTION_OPENED',
    'MOTION_RESULT',
    'MOTION_SECONDED',
    'MOTION_COMMENT',
    'MOTION_CIRCULATED',
    'CORRECTION_RESOLVED',
    'ELECTION_OPENED',
    'ELECTION_RESULT',
    'FEATURE_REQUEST_UPDATED',
    'DISCUSSION_REPLY',
    'DISCUSSION_OPENED',
  ],
} as const satisfies Record<string, readonly NotificationType[]>

export const NotificationKindSchema = z.enum(['social', 'music', 'money', 'governance', 'other'])
export type NotificationKind = z.infer<typeof NotificationKindSchema>

/** The types filter for a kind: `in` for a named group, `notIn` every named
 * group for `other`. */
export function notificationKindTypes(
  kind: NotificationKind,
): { in: NotificationType[] } | { notIn: NotificationType[] } {
  if (kind === 'other') {
    return { notIn: Object.values(NOTIFICATION_KIND_TYPES).flat() }
  }
  return { in: [...NOTIFICATION_KIND_TYPES[kind]] }
}

/** The kind a notification type is filed under. */
export function notificationKindOf(type: string): NotificationKind {
  for (const [kind, types] of Object.entries(NOTIFICATION_KIND_TYPES)) {
    if ((types as readonly string[]).includes(type)) return kind as NotificationKind
  }
  return 'other'
}

export const NotificationUnreadCountsSchema = z.object({
  total: z.number().int().nonnegative(),
  byKind: z.object({
    social: z.number().int().nonnegative(),
    music: z.number().int().nonnegative(),
    money: z.number().int().nonnegative(),
    governance: z.number().int().nonnegative(),
    other: z.number().int().nonnegative(),
  }),
})
