// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { buildMusicbrainzSeedUrl } from './musicbrainz-seed.js'

describe('buildMusicbrainzSeedUrl', () => {
  it('builds a seed URL with tracks, date, and type mapping', () => {
    const url = buildMusicbrainzSeedUrl({
      title: 'Skerries',
      artistName: 'Harmaja Drift',
      type: 'ALBUM',
      releaseDate: '2026-08-17T00:00:00.000Z',
      upc: '012345678905',
      tracks: [
        { title: 'Low Tide', durationSec: 180 },
        { title: 'Harmaja', durationSec: 210.6 },
      ],
      sourceUrl: 'https://tahti.live/r/skerries-abc123',
    })
    const params = new URL(url).searchParams

    expect(url.startsWith('https://musicbrainz.org/release/add?')).toBe(true)
    expect(params.get('name')).toBe('Skerries')
    expect(params.get('artist_credit.names.0.artist.name')).toBe('Harmaja Drift')
    expect(params.get('type')).toBe('Album')
    expect(params.get('events.0.date.year')).toBe('2026')
    expect(params.get('events.0.date.month')).toBe('8')
    expect(params.get('events.0.date.day')).toBe('17')
    expect(params.get('barcode')).toBe('012345678905')
    expect(params.get('mediums.0.track.0.name')).toBe('Low Tide')
    expect(params.get('mediums.0.track.0.length')).toBe('180000')
    expect(params.get('mediums.0.track.1.length')).toBe('210600')
    expect(params.get('urls.0.url')).toBe('https://tahti.live/r/skerries-abc123')
  })

  it('maps SINGLE/EP/COMPILATION/REMIX types correctly', () => {
    const typeOf = (type: 'SINGLE' | 'EP' | 'ALBUM' | 'COMPILATION' | 'REMIX') =>
      new URL(
        buildMusicbrainzSeedUrl({ title: 'T', artistName: 'A', type, tracks: [] }),
      ).searchParams.get('type')

    expect(typeOf('SINGLE')).toBe('Single')
    expect(typeOf('EP')).toBe('EP')
    expect(typeOf('COMPILATION')).toBe('Compilation')
    expect(typeOf('REMIX')).toBe('Album')
  })

  it('omits optional fields cleanly when absent', () => {
    const url = buildMusicbrainzSeedUrl({
      title: 'Untitled',
      artistName: 'Artist',
      type: 'SINGLE',
      tracks: [{ title: 'Track One' }],
    })
    const params = new URL(url).searchParams

    expect(params.has('barcode')).toBe(false)
    expect(params.has('events.0.date.year')).toBe(false)
    expect(params.has('mediums.0.track.0.length')).toBe(false)
    expect(params.has('urls.0.url')).toBe(false)
  })
})
