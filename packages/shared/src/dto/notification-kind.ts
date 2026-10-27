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
  ],
  music: [
    'NEW_POST',
    'NEW_TRACK',
    'NEW_RELEASE',
    'NEW_EVENT',
    'CHANNEL_LIVE',
    'STREAMING_COPY_READY',
    'RADIO_SUBMISSION_REJECTED',
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
