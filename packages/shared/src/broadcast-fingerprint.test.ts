// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { fingerprintsToTracklistEntries } from './broadcast-fingerprint.js'

describe('fingerprintsToTracklistEntries', () => {
  it('collapses consecutive identical fingerprints', () => {
    const entries = fingerprintsToTracklistEntries([
      {
        offsetSec: 0,
        durationSec: 12,
        fingerprint: 'AQAA_one',
        capturedAt: '2026-06-05T12:00:00.000Z',
      },
      {
        offsetSec: 30,
        durationSec: 12,
        fingerprint: 'AQAA_one',
        capturedAt: '2026-06-05T12:00:30.000Z',
      },
      {
        offsetSec: 60,
        durationSec: 12,
        fingerprint: 'AQAA_two',
        capturedAt: '2026-06-05T12:01:00.000Z',
      },
    ])

    expect(entries).toHaveLength(2)
    expect(entries[0]?.title).toBe('Broadcast start')
    expect(entries[1]?.startSec).toBe(60)
    expect(entries[1]?.title).toBe('Track change (1:00)')
  })

  it('applies AcoustID identifications when provided', () => {
    const segments = [
      {
        offsetSec: 0,
        durationSec: 12,
        fingerprint: 'AQAA_one',
        capturedAt: '2026-06-05T12:00:00.000Z',
      },
      {
        offsetSec: 90,
        durationSec: 12,
        fingerprint: 'AQAA_two',
        capturedAt: '2026-06-05T12:01:30.000Z',
      },
    ]

    const entries = fingerprintsToTracklistEntries(segments, [
      null,
      { title: 'Good Life', artist: 'Inner City' },
    ])

    expect(entries[0]?.title).toBe('Broadcast start')
    expect(entries[1]).toEqual({
      startSec: 90,
      title: 'Good Life',
      artist: 'Inner City',
    })
  })
})
