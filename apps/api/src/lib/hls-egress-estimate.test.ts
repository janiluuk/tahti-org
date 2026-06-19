// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { estimateLiveHlsBytes, estimatedLiveBytesPerSecond } from './hls-egress-estimate.js'

describe('hls-egress-estimate', () => {
  it('uses MP3 bitrate for free tier', () => {
    expect(estimatedLiveBytesPerSecond('FREE')).toBe(24_000)
    expect(estimateLiveHlsBytes(10, 'FREE')).toBe(240_000)
  })

  it('uses FLAC-class bitrate for member tiers', () => {
    expect(estimatedLiveBytesPerSecond('ARTIST')).toBe(176_375)
    expect(estimatedLiveBytesPerSecond('STUDIO')).toBe(176_375)
  })
})
