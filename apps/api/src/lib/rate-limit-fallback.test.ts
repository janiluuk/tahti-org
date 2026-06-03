// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { rateLimitWhenRedisUnavailable } from './rate-limit-fallback.js'

describe('rateLimitWhenRedisUnavailable (PLAT-006)', () => {
  it('fail-open allows traffic with high remaining', () => {
    const r = rateLimitWhenRedisUnavailable(true, 60)
    expect(r.ok).toBe(true)
    expect(r.remaining).toBe(999)
    expect(r.resetSec).toBe(60)
  })

  it('fail-closed rejects traffic', () => {
    const r = rateLimitWhenRedisUnavailable(false, 60)
    expect(r.ok).toBe(false)
    expect(r.remaining).toBe(0)
  })
})
