// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { buildMusicBrainzPrefill } from './release-ops.js'

describe('buildMusicBrainzPrefill', () => {
  it('formats release and track fields for MusicBrainz entry', () => {
    const text = buildMusicBrainzPrefill({
      title: 'Northern Lights',
      type: 'EP',
      releaseDate: new Date('2026-03-15'),
      description: 'Ambient EP',
      upc: '1234567890123',
      pLine: '℗ 2026 Demo',
      cLine: '© 2026 Demo',
      labelImprint: 'Tahti Demo',
      credits: [{ role: 'writer', name: 'Alex Demo' }],
      tracks: [
        { position: 1, title: 'Aurora', isrc: 'FI-XXX-26-00001' },
        { position: 2, title: 'Polar', isrc: null },
      ],
      user: { username: 'demo', displayName: 'Demo Artist' },
    })

    expect(text).toContain('Northern Lights')
    expect(text).toContain('Demo Artist')
    expect(text).toContain('1234567890123')
    expect(text).toContain('FI-XXX-26-00001')
    expect(text).toContain('Aurora')
    expect(text).toContain('Alex Demo')
  })
})
