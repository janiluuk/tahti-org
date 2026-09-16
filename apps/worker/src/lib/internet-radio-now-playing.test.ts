// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi } from 'vitest'
import { fetchNowPlaying, parserForUrl } from './internet-radio-now-playing.js'

// Trimmed to the exact markup shape each parser matches — confirmed against
// a live fetch of the real page on 2026-09-16, not fabricated from scratch.
const RADIO_HELSINKI_FRAGMENT = `
  <div class="current-song ">
    <h2 class="assistive-text">Nyt soi</h2>
    <div class="program-name current-program-title">CADIA</div>
    <div class="artist current-song-artist">Bloc Party</div>
    <div class="title current-song-title">Positive Tension</div>
  </div>
`

const BAUER_RADIOPLAY_FRAGMENT = `
  <script>window.__STATE__ = {"player":{"stationNowPlaying":{"nowPlayingTrackId":0,"nowPlayingTrack":"","nowPlayingArtist":""},"station":{}},
  "sidebar":{"stationNowPlaying":{"nowPlayingTrackId":279589,"nowPlayingTrack":"Usa","nowPlayingArtist":"Viivi"}}}</script>
`

describe('parserForUrl', () => {
  it('matches radiohelsinki.fi', () => {
    expect(parserForUrl('https://www.radiohelsinki.fi/ohjelmakartta/')).not.toBeNull()
  })

  it('matches radioplay.fi', () => {
    expect(parserForUrl('https://www.radioplay.fi/nrj')).not.toBeNull()
  })

  it('returns null for an unsupported host', () => {
    expect(parserForUrl('https://www.radiorock.fi/')).toBeNull()
  })

  it('returns null for an invalid URL', () => {
    expect(parserForUrl('not a url')).toBeNull()
  })
})

describe('fetchNowPlaying', () => {
  it('parses Radio Helsinki program + song', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(RADIO_HELSINKI_FRAGMENT),
    })
    const result = await fetchNowPlaying(
      'https://www.radiohelsinki.fi/ohjelmakartta/',
      fetchMock as unknown as typeof fetch,
    )
    expect(result).toEqual({ title: 'CADIA', artist: 'Bloc Party — Positive Tension' })
  })

  it('parses the last non-empty Bauer stationNowPlaying block', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(BAUER_RADIOPLAY_FRAGMENT),
    })
    const result = await fetchNowPlaying(
      'https://www.radioplay.fi/nrj',
      fetchMock as unknown as typeof fetch,
    )
    expect(result).toEqual({ title: 'Usa', artist: 'Viivi' })
  })

  it('returns null for a host with no parser, without fetching', async () => {
    const fetchMock = vi.fn()
    const result = await fetchNowPlaying(
      'https://www.radiorock.fi/',
      fetchMock as unknown as typeof fetch,
    )
    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null on a non-ok response instead of throwing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false })
    const result = await fetchNowPlaying(
      'https://www.radiohelsinki.fi/ohjelmakartta/',
      fetchMock as unknown as typeof fetch,
    )
    expect(result).toBeNull()
  })

  it('returns null when fetch rejects instead of throwing', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    const result = await fetchNowPlaying(
      'https://www.radiohelsinki.fi/ohjelmakartta/',
      fetchMock as unknown as typeof fetch,
    )
    expect(result).toBeNull()
  })
})
