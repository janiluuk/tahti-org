// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { config } from '../config.js'
import { isTrustedInternalRequest } from './internal-request.js'

describe('isTrustedInternalRequest', () => {
  it('accepts Bearer internal secret', () => {
    const request = {
      headers: { authorization: `Bearer ${config.internalSecret}` },
      ip: '8.8.8.8',
    }
    expect(isTrustedInternalRequest(request as never)).toBe(true)
  })

  it('accepts loopback without Bearer', () => {
    const request = { headers: {}, ip: '127.0.0.1' }
    expect(isTrustedInternalRequest(request as never)).toBe(true)
  })

  it('accepts private Docker network IPs', () => {
    const request = { headers: {}, ip: '10.0.1.5' }
    expect(isTrustedInternalRequest(request as never)).toBe(true)
  })

  it('rejects public IPs without Bearer', () => {
    const request = { headers: {}, ip: '203.0.113.50' }
    expect(isTrustedInternalRequest(request as never)).toBe(false)
  })
})
