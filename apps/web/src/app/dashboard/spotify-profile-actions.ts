// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export interface SpotifyArtistProfile {
  artistId: string
  name: string
  imageUrl: string | null
}

export async function fetchSpotifyProfile(): Promise<{
  configured: boolean
  profile: SpotifyArtistProfile | null
  error: string | null
}> {
  const res = await fetch(`${apiUrl}/api/me/spotify-profile`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    return { configured: false, profile: null, error: 'Failed to load Spotify profile' }
  }
  const data = (await res.json()) as { configured: boolean; profile: SpotifyArtistProfile | null }
  return { configured: data.configured, profile: data.profile, error: null }
}

export async function linkSpotifyProfile(
  artistUrl: string,
): Promise<{ profile: SpotifyArtistProfile | null; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/spotify-profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ artistUrl }),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { profile: null, error: (data as { error?: string }).error ?? 'Link failed' }
  }
  return { profile: (data as { profile: SpotifyArtistProfile }).profile, error: null }
}

export async function unlinkSpotifyProfile(): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/spotify-profile`, {
    method: 'DELETE',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Unlink failed' }
  }
  return { error: null }
}
