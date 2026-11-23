// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import {
  channelLiveCopy,
  groupJoinRequestedCopy,
  groupRoleChangedCopy,
  newFollowerCopy,
  resolveNotificationLocale,
  themeApprovedCopy,
  themeUnderReviewCopy,
} from './notification-copy.js'

describe('notification-copy', () => {
  it('defaults null/unknown uiLocale to English', () => {
    expect(resolveNotificationLocale(null)).toBe('en')
    expect(resolveNotificationLocale(undefined)).toBe('en')
    expect(resolveNotificationLocale('de')).toBe('en')
    expect(resolveNotificationLocale('fi')).toBe('fi')
  })

  it('localizes THEME_UNDER_REVIEW', () => {
    expect(themeUnderReviewCopy('en', 'Neon')).toEqual({
      title: '"Neon" is in review',
      body: 'An admin will approve or reject it soon.',
    })
    expect(themeUnderReviewCopy('fi', 'Neon')).toEqual({
      title: '"Neon" on arvioitavana',
      body: 'Ylläpito hyväksyy tai hylkää sen pian.',
    })
  })

  it('localizes NEW_FOLLOWER / CHANNEL_LIVE / THEME_APPROVED', () => {
    expect(newFollowerCopy('en', 'Ada', 'ada')).toEqual({
      title: 'Ada followed you',
      body: '@ada',
    })
    expect(newFollowerCopy('fi', 'Ada', 'ada')).toEqual({
      title: 'Ada alkoi seurata sinua',
      body: '@ada',
    })
    expect(channelLiveCopy('fi', 'Ada').title).toBe('Ada on livessä')
    expect(themeApprovedCopy('fi', 'Neon')).toEqual({
      title: '"Neon" hyväksyttiin',
      body: 'Avataan pull request julkaisua varten.',
    })
  })

  it('localizes group join and role notices', () => {
    expect(groupJoinRequestedCopy('en', 'Vinyl')).toEqual({
      title: 'New request to join your group',
      body: 'Someone asked to join Vinyl.',
    })
    expect(groupJoinRequestedCopy('fi', 'Vinyl')).toEqual({
      title: 'Uusi liittymispyyntö ryhmääsi',
      body: 'Joku pyysi liittyä ryhmään Vinyl.',
    })
    expect(groupRoleChangedCopy('en', 'Vinyl', 'ADMIN').title).toBe('You are now an admin of Vinyl')
    expect(groupRoleChangedCopy('fi', 'Vinyl', 'OWNER').title).toBe('Omistat nyt ryhmän Vinyl')
  })
})
