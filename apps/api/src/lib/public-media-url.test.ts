// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { publicMediaUrl } from './public-media-url.js'

describe('publicMediaUrl', () => {
  it('builds bucket URL from object key', () => {
    expect(publicMediaUrl('mp3/artist/track.mp3')).toBe(
      'http://localhost:9000/tahti/mp3/artist/track.mp3',
    )
  })

  it('returns null for empty key', () => {
    expect(publicMediaUrl(null)).toBeNull()
  })
})
