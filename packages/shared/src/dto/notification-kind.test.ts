// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { notificationKindOf } from './notification-kind.js'

describe('notificationKindOf', () => {
  it('files the newer notice types like tahti-web does', () => {
    expect(notificationKindOf('TRACK_SHARED')).toBe('social')
    expect(notificationKindOf('GREEN_ROOM_INVITE')).toBe('social')
    for (const type of [
      'RADIO_SUBMISSION_ACCEPTED',
      'RADIO_STATION_REVIEWED',
      'TRACK_EDITED_BY_BOARD',
      'CHANNEL_FORCED_OFFLINE',
      'VENUE_VERIFIED',
      'VENUE_SHOW_BOOKED',
      'VENUE_SHOW_CANCELED',
      'TAHTI_SELECTS_PICK',
      'TAHTI_RADIO_INCLUSION_CHANGED',
    ]) {
      expect(notificationKindOf(type)).toBe('music')
    }
    expect(notificationKindOf('FAN_SUB_CANCELED')).toBe('money')
    expect(notificationKindOf('GRANT_AWARDED')).toBe('money')
    expect(notificationKindOf('MEMBERSHIP_ENDED')).toBe('money')
    expect(notificationKindOf('BACKGROUND_JOB_DONE')).toBe('music')
    expect(notificationKindOf('BACKGROUND_JOB_FAILED')).toBe('music')
    for (const type of [
      'ACCOUNT_RESTRICTED',
      'BOARD_ACCOUNT_CHANGE',
      'ADDON_REVIEWED',
      'CONTENT_REMOVED_BY_BOARD',
    ]) {
      expect(notificationKindOf(type)).toBe('other')
    }
  })
})
