// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { parseSmartLinkTargets } from './smartlink.js'

describe('parseSmartLinkTargets', () => {
  it('accepts known DSP URLs and rejects unknown keys', () => {
    const ok = parseSmartLinkTargets({
      spotify: 'https://open.spotify.com/album/1',
      bandcamp: 'https://artist.bandcamp.com/album/x',
    })
    expect(ok).toEqual({
      spotify: 'https://open.spotify.com/album/1',
      bandcamp: 'https://artist.bandcamp.com/album/x',
    })

    const bad = parseSmartLinkTargets({ unknown: 'https://example.com' })
    expect(typeof bad).toBe('string')
  })
})
