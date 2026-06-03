// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { evaluateDownloadCountPolicy } from './download-ip-policy.js'

describe('evaluateDownloadCountPolicy', () => {
  it('blocks datacenter CIDRs from counting', () => {
    const r = evaluateDownloadCountPolicy({
      clientIp: '203.0.113.50',
      noCountCidrs: ['203.0.113.0/24'],
    })
    expect(r.shouldCount).toBe(false)
    expect(r.reason).toBe('tor_or_datacenter')
  })

  it('trust override allows counting inside a blocked CIDR', () => {
    const r = evaluateDownloadCountPolicy({
      clientIp: '203.0.113.50',
      noCountCidrs: ['203.0.113.0/24'],
      trustOverrideIps: ['203.0.113.50'],
    })
    expect(r.shouldCount).toBe(true)
  })

  it('blocks obvious bot user agents', () => {
    const r = evaluateDownloadCountPolicy({
      clientIp: '198.51.100.1',
      userAgent: 'python-requests/2.31',
    })
    expect(r.shouldCount).toBe(false)
    expect(r.reason).toBe('bot_ua')
  })
})
