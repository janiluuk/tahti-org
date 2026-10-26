// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi } from 'vitest'
import { fetchNowPlaying, parserForUrl } from './internet-radio-now-playing.js'
import { NOW_PLAYING_USER_AGENT } from '@tahti/shared'

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

// Shape of www.radiohelsinki.fi/wp-content/djonline.js, trimmed from a live
// fetch on 2026-10-26.
const RADIO_HELSINKI_FEED = JSON.stringify({
  programs: {
    current: {
      type: 'ondemand',
      program_title: 'MITÄ TÄÄLLÄ TAPAHTUU',
      begin: '2026-10-26 18:00:00',
      end: '2026-10-27 00:00:00',
    },
    next: [],
  },
  last_playing: [
    {
      id: '58366',
      artist: 'Beach House',
      song: 'On the Sea ',
      length: '05:25',
      _start: 1793042107,
    },
    {
      id: '54756',
      artist: 'Feist',
      song: 'Calling All the Gods',
      length: '03:49',
      _start: 1793041818,
    },
  ],
  generated: '2026-10-26 21:19:00',
})

function respondByUrl(bodies: { feed?: string | null; page?: string | null }) {
  return vi.fn((url: string) => {
    const body = url.includes('/wp-content/djonline.js') ? bodies.feed : bodies.page
    return Promise.resolve(
      body == null ? { ok: false } : { ok: true, text: () => Promise.resolve(body) },
    )
  })
}

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

  it('skips a whole site that is switched off', () => {
    expect(parserForUrl('https://www.radioplay.fi/nrj', ['radioplay.fi'])).toBeNull()
    expect(parserForUrl('https://www.radiohelsinki.fi/', ['radioplay.fi'])).not.toBeNull()
  })

  it('skips one station on a shared site and keeps the others', () => {
    const off = ['www.radioplay.fi/nrj/']
    expect(parserForUrl('https://www.radioplay.fi/nrj', off)).toBeNull()
    expect(parserForUrl('https://radioplay.fi/nrj/kuuntele', off)).toBeNull()
    expect(parserForUrl('https://www.radioplay.fi/radio-nova', off)).not.toBeNull()
    expect(parserForUrl('https://www.radioplay.fi/nrjx', off)).not.toBeNull()
  })

  it('reads the switch from NOW_PLAYING_DISABLED_HOSTS', () => {
    vi.stubEnv('NOW_PLAYING_DISABLED_HOSTS', ' RadioHelsinki.fi , ')
    expect(parserForUrl('https://www.radiohelsinki.fi/ohjelmakartta/')).toBeNull()
    vi.unstubAllEnvs()
    expect(parserForUrl('https://www.radiohelsinki.fi/ohjelmakartta/')).not.toBeNull()
  })
})

describe('fetchNowPlaying', () => {
  it('reads Radio Helsinki from the live feed the site itself polls', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-26T19:19:28.500Z') })
    const fetchMock = respondByUrl({ feed: RADIO_HELSINKI_FEED, page: RADIO_HELSINKI_FRAGMENT })
    const result = await fetchNowPlaying(
      'https://www.radiohelsinki.fi/ohjelmakartta/',
      fetchMock as unknown as typeof fetch,
    )
    vi.useRealTimers()
    expect(result).toEqual({
      title: 'MITÄ TÄÄLLÄ TAPAHTUU',
      artist: 'Beach House — On the Sea',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `https://www.radiohelsinki.fi/wp-content/djonline.js?dt=${Date.parse('2026-10-26T19:19:20Z')}`,
    )
  })

  it('falls back to the Radio Helsinki page while the feed is being rewritten', async () => {
    const fetchMock = respondByUrl({ feed: '', page: RADIO_HELSINKI_FRAGMENT })
    const result = await fetchNowPlaying(
      'https://www.radiohelsinki.fi/ohjelmakartta/',
      fetchMock as unknown as typeof fetch,
    )
    expect(result).toEqual({ title: 'CADIA', artist: 'Bloc Party — Positive Tension' })
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://www.radiohelsinki.fi/ohjelmakartta/')
  })

  it('falls back to the Radio Helsinki page when the feed is unreachable', async () => {
    const fetchMock = respondByUrl({ feed: null, page: RADIO_HELSINKI_FRAGMENT })
    const result = await fetchNowPlaying(
      'https://www.radiohelsinki.fi/ohjelmakartta/',
      fetchMock as unknown as typeof fetch,
    )
    expect(result).toEqual({ title: 'CADIA', artist: 'Bloc Party — Positive Tension' })
  })

  it('reads the Radio Helsinki show when no song is listed', async () => {
    const feed = JSON.stringify({
      programs: { current: { program_title: 'CADIA' } },
      last_playing: [],
    })
    const fetchMock = respondByUrl({ feed, page: RADIO_HELSINKI_FRAGMENT })
    const result = await fetchNowPlaying(
      'https://www.radiohelsinki.fi/ohjelmakartta/',
      fetchMock as unknown as typeof fetch,
    )
    expect(result).toEqual({ title: 'CADIA', artist: null })
  })

  it('parses Radio Helsinki program + song from the page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(RADIO_HELSINKI_FRAGMENT),
    })
    const result = await fetchNowPlaying(
      'https://www.radiohelsinki.fi/ohjelmakartta/',
      fetchMock as unknown as typeof fetch,
    )
    expect(result).toEqual({ title: 'CADIA', artist: 'Bloc Party — Positive Tension' })
    expect(fetchMock.mock.calls[0]?.[1]).toEqual({
      headers: { 'User-Agent': NOW_PLAYING_USER_AGENT },
    })
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
