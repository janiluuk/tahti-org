// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { clientIpFromHeaders } from './client-ip.js'

describe('clientIpFromHeaders', () => {
  it('returns the right-most (nearest-hop) X-Forwarded-For address', () => {
    // SEC-014: the left-most entry is whatever the client put there
    // themselves; only the right-most entry is appended by our own proxy
    // and can't be forged.
    expect(clientIpFromHeaders({ 'x-forwarded-for': '203.0.113.1, 10.0.0.1' }, '127.0.0.1')).toBe(
      '10.0.0.1',
    )
  })

  it('falls back to X-Real-IP then socket IP', () => {
    expect(clientIpFromHeaders({ 'x-real-ip': '198.51.100.2' }, '127.0.0.1')).toBe('198.51.100.2')
    expect(clientIpFromHeaders({}, '127.0.0.1')).toBe('127.0.0.1')
  })
})
