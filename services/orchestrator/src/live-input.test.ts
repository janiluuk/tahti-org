// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { liveInputUrl } from './live-input.js'

describe('liveInputUrl', () => {
  it('uses Icecast mount for ICECAST source', () => {
    expect(liveInputUrl('ICECAST', 'artist-one')).toBe('http://icecast:8000/live/artist-one')
  })

  it('uses edge encoder relay for RTMP source', () => {
    expect(liveInputUrl('RTMP', 'artist-one')).toBe('http://tahti-edge-artist-one:8090/stream')
  })
})
