// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { hashHlsListenerId } from './hls-listener-hash.js'

describe('hashHlsListenerId', () => {
  it('is stable for the same IP and UTC date', () => {
    expect(hashHlsListenerId('203.0.113.7', '2026-06-08')).toBe(
      hashHlsListenerId('203.0.113.7', '2026-06-08'),
    )
  })

  it('differs across UTC days (daily-rotating salt)', () => {
    const day1 = hashHlsListenerId('203.0.113.7', '2026-06-08')
    const day2 = hashHlsListenerId('203.0.113.7', '2026-06-09')
    expect(day1).not.toBe(day2)
  })

  it('differs between distinct IPs on the same day', () => {
    const a = hashHlsListenerId('203.0.113.7', '2026-06-08')
    const b = hashHlsListenerId('198.51.100.2', '2026-06-08')
    expect(a).not.toBe(b)
  })

  it('never returns the raw IP', () => {
    const hash = hashHlsListenerId('203.0.113.7', '2026-06-08')
    expect(hash).not.toContain('203.0.113.7')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})
