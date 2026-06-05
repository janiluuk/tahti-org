// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { buildAcrcloudSignature, parseAcrcloudIdentifyResponse } from './acrcloud.js'

describe('buildAcrcloudSignature', () => {
  it('is deterministic for fixed inputs', () => {
    const sig = buildAcrcloudSignature({
      accessKey: 'test-key',
      accessSecret: 'test-secret',
      timestamp: 1_700_000_000,
    })
    expect(sig).toMatch(/^[A-Za-z0-9+/=]+$/)
    expect(
      buildAcrcloudSignature({
        accessKey: 'test-key',
        accessSecret: 'test-secret',
        timestamp: 1_700_000_000,
      }),
    ).toBe(sig)
  })
})

describe('parseAcrcloudIdentifyResponse', () => {
  it('returns best music match', () => {
    const match = parseAcrcloudIdentifyResponse({
      status: { code: 0, msg: 'Success' },
      metadata: {
        music: [
          { title: 'Weak', artists: [{ name: 'A' }], score: 40 },
          { title: 'Strong Track', artists: [{ name: 'Artist B' }], score: 95 },
        ],
      },
    })

    expect(match).toEqual({
      title: 'Strong Track',
      artist: 'Artist B',
      score: 95,
    })
  })

  it('returns null on non-zero status', () => {
    expect(parseAcrcloudIdentifyResponse({ status: { code: 1001 } })).toBeNull()
  })
})
