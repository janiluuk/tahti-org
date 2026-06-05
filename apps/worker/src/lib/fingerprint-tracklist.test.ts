// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LiveFingerprintSegment } from '@tahti/shared'
import {
  buildTracklistFromFingerprints,
  identifyFingerprintBoundaries,
  lookupAcoustidTrack,
} from './fingerprint-tracklist.js'

const segment = (offsetSec: number, fingerprint: string): LiveFingerprintSegment => ({
  offsetSec,
  durationSec: 12,
  fingerprint,
  capturedAt: '2026-06-05T12:00:00.000Z',
})

describe('lookupAcoustidTrack', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null without API key', async () => {
    delete process.env.ACOUSTID_API_KEY
    await expect(lookupAcoustidTrack(segment(0, 'AQAA_test'))).resolves.toBeNull()
  })

  it('parses AcoustID response', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            score: 0.95,
            recordings: [{ title: 'Track One', artists: [{ name: 'Artist A' }] }],
          },
        ],
      }),
    })

    const match = await lookupAcoustidTrack(segment(30, 'AQAA_match'), {
      apiKey: 'test-key',
      fetchFn,
    })

    expect(match).toEqual({ title: 'Track One', artist: 'Artist A' })
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.acoustid.org/v2/lookup',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

describe('identifyFingerprintBoundaries', () => {
  it('deduplicates lookups by fingerprint', async () => {
    const lookup = vi.fn(async (seg: LiveFingerprintSegment) =>
      seg.fingerprint === 'fp_b' ? { title: 'Second' } : null,
    )

    const ids = await identifyFingerprintBoundaries(
      [segment(0, 'fp_a'), segment(30, 'fp_a'), segment(60, 'fp_b')],
      lookup,
    )

    expect(lookup).toHaveBeenCalledTimes(2)
    expect(ids).toEqual([null, { title: 'Second' }])
  })
})

describe('buildTracklistFromFingerprints', () => {
  it('merges identifications into tracklist entries', async () => {
    const lookup = vi.fn(async (seg: LiveFingerprintSegment) =>
      seg.fingerprint === 'fp_b' ? { title: 'Identified', artist: 'DJ' } : null,
    )

    const tracklist = await buildTracklistFromFingerprints(
      [segment(0, 'fp_a'), segment(120, 'fp_b')],
      lookup,
    )

    expect(tracklist).toEqual([
      { startSec: 0, title: 'Broadcast start' },
      { startSec: 120, title: 'Identified', artist: 'DJ' },
    ])
  })
})
