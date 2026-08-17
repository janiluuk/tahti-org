// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import { hearthisEmbedSrc } from './hearthis-embed.js'

describe('hearthisEmbedSrc', () => {
  it('keeps visible widget controls and escapes the track id', () => {
    const url = hearthisEmbedSrc('123/unsafe')
    expect(url).toContain('/embed/123%2Funsafe/transparent_black/')
    expect(url).toContain('waveform=1')
    expect(url).toContain('cover=1')
    expect(url).toContain('block_size=2')
  })
})
