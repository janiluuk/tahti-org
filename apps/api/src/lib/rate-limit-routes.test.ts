// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { usesAuthRateLimit } from './rate-limit-routes.js'

describe('usesAuthRateLimit', () => {
  it('treats register and login POST as auth routes', () => {
    expect(usesAuthRateLimit('/api/auth/register', 'POST')).toBe(true)
    expect(usesAuthRateLimit('/api/auth/login', 'POST')).toBe(true)
  })

  it('treats email verification and password setup as auth routes', () => {
    expect(usesAuthRateLimit('/api/auth/verify', 'GET')).toBe(true)
    expect(usesAuthRateLimit('/api/auth/setup-password', 'GET')).toBe(true)
    expect(usesAuthRateLimit('/api/auth/setup-password', 'POST')).toBe(true)
  })

  it('treats chat POST as auth routes', () => {
    expect(usesAuthRateLimit('/api/chat/tahti-radio/token', 'POST')).toBe(true)
    expect(usesAuthRateLimit('/api/chat/message', 'POST')).toBe(true)
    expect(usesAuthRateLimit('/api/chat/tahti-radio/viewer-token', 'POST')).toBe(true)
  })

  it('does not rate-limit chat GET discovery on the auth bucket', () => {
    expect(usesAuthRateLimit('/api/chat/tahti-radio/access', 'GET')).toBe(false)
    expect(usesAuthRateLimit('/api/chat/tahti-radio/announcements', 'GET')).toBe(false)
    expect(usesAuthRateLimit('/api/chat/tahti-radio/reactions-token', 'GET')).toBe(false)
  })

  it('ignores unrelated routes', () => {
    expect(usesAuthRateLimit('/api/v1/channels', 'GET')).toBe(false)
    expect(usesAuthRateLimit('/api/v1/venues', 'GET')).toBe(false)
    expect(usesAuthRateLimit('/api/me/releases', 'GET')).toBe(false)
  })
})
