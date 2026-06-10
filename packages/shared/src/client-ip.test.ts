// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { clientIpFromHeaders } from './client-ip.js'

describe('clientIpFromHeaders', () => {
  it('returns leftmost X-Forwarded-For address', () => {
    expect(clientIpFromHeaders({ 'x-forwarded-for': '203.0.113.1, 10.0.0.1' }, '127.0.0.1')).toBe(
      '203.0.113.1',
    )
  })

  it('falls back to X-Real-IP then socket IP', () => {
    expect(clientIpFromHeaders({ 'x-real-ip': '198.51.100.2' }, '127.0.0.1')).toBe('198.51.100.2')
    expect(clientIpFromHeaders({}, '127.0.0.1')).toBe('127.0.0.1')
  })
})
