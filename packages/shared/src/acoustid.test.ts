// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { parseAcoustidLookupResponse } from './acoustid.js'

describe('parseAcoustidLookupResponse', () => {
  it('returns highest-scoring recording with artist', () => {
    const match = parseAcoustidLookupResponse({
      results: [
        {
          score: 0.4,
          recordings: [{ title: 'Weak match', artists: [{ name: 'A' }] }],
        },
        {
          score: 0.92,
          recordings: [{ title: 'Inner City', artists: [{ name: 'Good Life' }] }],
        },
      ],
    })

    expect(match).toEqual({
      title: 'Inner City',
      artist: 'Good Life',
      score: 0.92,
    })
  })

  it('returns null when no recordings', () => {
    expect(parseAcoustidLookupResponse({ results: [{ score: 0.9 }] })).toBeNull()
    expect(parseAcoustidLookupResponse(null)).toBeNull()
  })
})
