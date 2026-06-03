// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { buildReleaseExportCsv, computeReleaseChecklist } from './release-ops.js'

describe('release-ops', () => {
  it('buildReleaseExportCsv includes track row', () => {
    const csv = buildReleaseExportCsv({
      artist: { username: 'demo', displayName: 'Demo' },
      release: {
        title: 'EP',
        type: 'EP',
        releaseDate: '2026-06-01T00:00:00.000Z',
        upc: '123',
        musicbrainzReleaseId: null,
        musicbrainzArtistId: null,
        pLine: null,
        cLine: null,
        labelImprint: null,
      },
      tracks: [
        {
          position: 1,
          title: 'Track One',
          isrc: 'FI-XXX-26001',
          musicbrainzRecordingId: null,
          durationSec: 200,
        },
      ],
    })
    expect(csv).toContain('Track One')
    expect(csv).toContain('FI-XXX-26001')
  })

  it('checklist includes newsletter when artist has sent', () => {
    const steps = computeReleaseChecklist(
      {
        title: 'T',
        releaseDate: new Date(),
        description: 'd',
        artworkUrl: null,
        state: 'DRAFT',
        upc: null,
        musicbrainzReleaseId: null,
        revelatorStatus: null,
        smartLinkTargets: null,
        tracks: [{ isrc: null }],
      },
      { artistNewsletterSent: true },
    )
    expect(steps.find((s) => s.id === 'newsletter')?.done).toBe(true)
  })
})
