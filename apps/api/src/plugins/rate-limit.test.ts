// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { authLimit, defaultLimit, rateLimitKey } from './rate-limit.js'

describe('rate limit buckets', () => {
  it('counts auth requests in their own bucket, not the general api one', () => {
    const now = 1_800_000_000_000
    const auth = rateLimitKey(authLimit(), '203.0.113.7', now)
    const api = rateLimitKey(defaultLimit(), '203.0.113.7', now)
    expect(auth).toMatch(/^rl:auth:203\.0\.113\.7:/)
    expect(api).toMatch(/^rl:api:203\.0\.113\.7:/)
    expect(auth).not.toBe(api)
  })

  it('keeps one window per minute', () => {
    const start = 1_800_000_000_000 - (1_800_000_000_000 % 60_000)
    expect(rateLimitKey(defaultLimit(), '1.2.3.4', start)).toBe(
      rateLimitKey(defaultLimit(), '1.2.3.4', start + 59_999),
    )
    expect(rateLimitKey(defaultLimit(), '1.2.3.4', start)).not.toBe(
      rateLimitKey(defaultLimit(), '1.2.3.4', start + 60_000),
    )
  })
})
