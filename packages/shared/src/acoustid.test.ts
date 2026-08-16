// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { parseAcoustidLookupResponse, parseAcoustidFullLookupResponse } from './acoustid.js'

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

describe('parseAcoustidFullLookupResponse', () => {
  it('includes the MusicBrainz recording id when linked', () => {
    const match = parseAcoustidFullLookupResponse({
      results: [
        {
          id: 'fp-123',
          score: 0.988,
          recordings: [
            { id: 'mb-recording-456', title: 'Inner City', artists: [{ name: 'Good Life' }] },
          ],
        },
      ],
    })

    expect(match).toEqual({
      acoustidId: 'fp-123',
      score: 0.988,
      recordingId: 'mb-recording-456',
      title: 'Inner City',
      artist: 'Good Life',
    })
  })

  it('still returns a match when the fingerprint is known but has no linked recording', () => {
    const match = parseAcoustidFullLookupResponse({
      results: [{ id: 'fp-789', score: 0.55 }],
    })

    expect(match).toEqual({ acoustidId: 'fp-789', score: 0.55 })
  })

  it('returns null when the fingerprint has no results at all', () => {
    expect(parseAcoustidFullLookupResponse({ results: [] })).toBeNull()
    expect(parseAcoustidFullLookupResponse(null)).toBeNull()
  })
})
