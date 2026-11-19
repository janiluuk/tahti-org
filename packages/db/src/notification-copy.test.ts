// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { resolveNotificationLocale, themeUnderReviewCopy } from './notification-copy.js'

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
})
