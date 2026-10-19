// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import {
  parseSpotifyArtistId,
  parseSpotifyPlaylistId,
  spotifyTrackUri,
  trackIdFromSpotifyUri,
} from './spotify.js'

describe('spotify URI/URL parsing', () => {
  it('extracts a track ID from a well-formed URI', () => {
    expect(trackIdFromSpotifyUri('spotify:track:4cOdK2wGLETKBW3PvgPWqT')).toBe(
      '4cOdK2wGLETKBW3PvgPWqT',
    )
  })

  it('rejects malformed track URIs', () => {
    expect(trackIdFromSpotifyUri('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT')).toBe(
      null,
    )
    expect(trackIdFromSpotifyUri('spotify:album:4cOdK2wGLETKBW3PvgPWqT')).toBe(null)
    expect(trackIdFromSpotifyUri('not a uri at all')).toBe(null)
  })

  it('round-trips spotifyTrackUri', () => {
    expect(spotifyTrackUri('abc123')).toBe('spotify:track:abc123')
  })

  it('resolves an artist ID from a profile URL with tracking params', () => {
    expect(
      parseSpotifyArtistId(
        'https://open.spotify.com/artist/06HL4z0CvFAxyc27GXpf02?si=abcdef1234567890',
      ),
    ).toBe('06HL4z0CvFAxyc27GXpf02')
  })

  it('resolves an artist ID from a spotify:artist: URI', () => {
    expect(parseSpotifyArtistId('spotify:artist:06HL4z0CvFAxyc27GXpf02')).toBe(
      '06HL4z0CvFAxyc27GXpf02',
    )
  })

  it('accepts a bare 22-char ID', () => {
    expect(parseSpotifyArtistId('06HL4z0CvFAxyc27GXpf02')).toBe('06HL4z0CvFAxyc27GXpf02')
  })

  it('rejects unrelated URLs and garbage input', () => {
    expect(parseSpotifyArtistId('https://example.com/artist/xyz')).toBe(null)
    expect(parseSpotifyArtistId('not an id')).toBe(null)
  })

  it('resolves a playlist ID from a URL with tracking params', () => {
    expect(
      parseSpotifyPlaylistId(
        'https://open.spotify.com/playlist/2esDahb3pYLC84NF3bWx98?si=f022a0a9cc20432f',
      ),
    ).toBe('2esDahb3pYLC84NF3bWx98')
  })

  it('resolves a playlist ID from an intl path', () => {
    expect(
      parseSpotifyPlaylistId('https://open.spotify.com/intl-fi/playlist/2esDahb3pYLC84NF3bWx98'),
    ).toBe('2esDahb3pYLC84NF3bWx98')
  })

  it('resolves a playlist ID from a spotify:playlist: URI', () => {
    expect(parseSpotifyPlaylistId('spotify:playlist:2esDahb3pYLC84NF3bWx98')).toBe(
      '2esDahb3pYLC84NF3bWx98',
    )
  })

  it('rejects unrelated playlist input', () => {
    expect(parseSpotifyPlaylistId('https://open.spotify.com/track/abc')).toBe(null)
    expect(parseSpotifyPlaylistId('not a playlist')).toBe(null)
  })
})
