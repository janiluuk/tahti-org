// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * Mixed-source collections brief: Spotify search + embed.
 * Search/catalog browsing uses an app-level Client Credentials Grant token —
 * never a per-user OAuth login. We never fetch or store Spotify audio; every
 * track this module returns is a reference (URI) for an official embed.
 */

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'

/** Spotify cover-art CDN — the only host the image proxy route is allowed to fetch from. */
export const SPOTIFY_IMAGE_CDN_HOST = 'i.scdn.co'

export interface SpotifyOAuthConfig {
  clientId: string
  clientSecret: string
}

export interface SpotifyAppToken {
  accessToken: string
  expiresAt: number // epoch ms
}

/** Client Credentials Grant — app-level token, no user context, search/catalog scope only. */
export async function fetchSpotifyAppToken(config: SpotifyOAuthConfig): Promise<SpotifyAppToken> {
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })
  if (!res.ok) throw new Error('Spotify token request failed')
  const data = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!data.access_token) throw new Error('No access token in Spotify token response')
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  }
}

/** Extracts the 22-char base62 ID from a spotify:track:ID URI. Returns null if malformed. */
export function trackIdFromSpotifyUri(uri: string): string | null {
  const m = /^spotify:track:([A-Za-z0-9]+)$/.exec(uri.trim())
  return m ? m[1] : null
}

export function spotifyTrackUri(trackId: string): string {
  return `spotify:track:${trackId}`
}

/**
 * Resolves an artist ID from a pasted Spotify artist URL, a spotify:artist:ID URI,
 * or a bare ID. Returns null if none of those patterns match.
 */
export function parseSpotifyArtistId(input: string): string | null {
  const trimmed = input.trim()

  const uriMatch = /^spotify:artist:([A-Za-z0-9]+)$/.exec(trimmed)
  if (uriMatch) return uriMatch[1]

  try {
    const url = new URL(trimmed)
    if (url.hostname === 'open.spotify.com' || url.hostname.endsWith('.spotify.com')) {
      const pathMatch = /\/artist\/([A-Za-z0-9]+)/.exec(url.pathname)
      if (pathMatch) return pathMatch[1]
    }
    return null
  } catch {
    // Not a URL — treat a bare 22-char base62 token as an ID.
    return /^[A-Za-z0-9]{22}$/.test(trimmed) ? trimmed : null
  }
}

export interface SpotifyTrackResult {
  uri: string
  title: string
  artists: string[]
  album: string | null
  durationSec: number
  coverUrl: string | null
}

interface RawSpotifyTrack {
  id: string
  uri: string
  name: string
  duration_ms: number
  artists?: Array<{ id: string; name: string }>
  album?: { name?: string; images?: Array<{ url: string }> }
}

function mapSpotifyTrack(track: RawSpotifyTrack): SpotifyTrackResult {
  return {
    uri: track.uri,
    title: track.name,
    artists: (track.artists ?? []).map((a) => a.name),
    album: track.album?.name ?? null,
    durationSec: Math.round(track.duration_ms / 1000),
    coverUrl: track.album?.images?.[0]?.url ?? null,
  }
}

async function spotifyApiGet<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${SPOTIFY_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Spotify API request failed (${res.status}): ${path}`)
  return (await res.json()) as T
}

export async function searchSpotifyTracks(
  accessToken: string,
  query: string,
  limit = 20,
): Promise<SpotifyTrackResult[]> {
  const params = new URLSearchParams({ q: query, type: 'track', limit: String(limit) })
  const data = await spotifyApiGet<{ tracks: { items: RawSpotifyTrack[] } }>(
    accessToken,
    `/search?${params.toString()}`,
  )
  return data.tracks.items.map(mapSpotifyTrack)
}

export async function getSpotifyTrack(
  accessToken: string,
  trackId: string,
): Promise<SpotifyTrackResult> {
  const data = await spotifyApiGet<RawSpotifyTrack>(accessToken, `/tracks/${trackId}`)
  return mapSpotifyTrack(data)
}

/**
 * Lists tracks where `artistId` is the primary (first-credited) artist, across
 * that artist's albums/singles — the catalogue view for "Your tracks" / "By
 * artist URL", not the listener's saved-library `me/tracks` endpoint.
 */
export async function getSpotifyArtistTracks(
  accessToken: string,
  artistId: string,
  limit = 50,
): Promise<SpotifyTrackResult[]> {
  const albumsData = await spotifyApiGet<{ items: Array<{ id: string }> }>(
    accessToken,
    `/artists/${artistId}/albums?include_groups=album,single&limit=${limit}`,
  )

  const tracks: SpotifyTrackResult[] = []
  for (const album of albumsData.items) {
    const albumTracks = await spotifyApiGet<{ items: RawSpotifyTrack[] }>(
      accessToken,
      `/albums/${album.id}/tracks?limit=50`,
    )
    for (const track of albumTracks.items) {
      if (track.artists?.[0]?.id === artistId) {
        tracks.push(mapSpotifyTrack(track))
      }
    }
    if (tracks.length >= limit) break
  }
  return tracks.slice(0, limit)
}
