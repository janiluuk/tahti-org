// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import type {
  CollectionGalleryMode,
  CollectionTextLayerAlignment,
  CollectionTextLayerMode,
  SpotifyTrackResult,
} from '@tahti/shared'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export async function createCollection(params: {
  name: string
  slug?: string
  type?: string
  description?: string
  isPublic?: boolean
}): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to create collection' }
  }
  return { error: null }
}

export async function addCollectionItem(
  slug: string,
  params: { archiveItemId?: string; releaseId?: string },
): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/collections/${encodeURIComponent(slug)}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to add item' }
  }
  return { error: null }
}

export async function reorderCollectionItems(
  slug: string,
  itemIds: string[],
): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/collections/${encodeURIComponent(slug)}/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ itemIds }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to reorder' }
  }
  return { error: null }
}

export async function updateCollection(
  slug: string,
  params: {
    isFeatured?: boolean
    isPublic?: boolean
    coverUrl?: string | null
    description?: string | null
  },
): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/collections/${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to update collection' }
  }
  return { error: null }
}

export async function updateCollectionGallery(
  slug: string,
  payload: {
    galleryMode?: CollectionGalleryMode
    slideshowImages?: string[]
    videoBackgroundUrl?: string | null
  },
): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/collections/${encodeURIComponent(slug)}/gallery`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to save gallery' }
  }
  return { error: null }
}

export async function updateCollectionTextLayer(
  slug: string,
  payload: {
    textLayerMode?: CollectionTextLayerMode
    textLayerText?: string
    textLayerAlign?: CollectionTextLayerAlignment
  },
): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/collections/${encodeURIComponent(slug)}/text-layer`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to save text layer' }
  }
  return { error: null }
}

export async function deleteCollection(slug: string): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/collections/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to delete collection' }
  }
  return { error: null }
}

// ── Mixed-source collections: Spotify search + embed (View 13) ────────────

type SpotifyTracksResult = { tracks: SpotifyTrackResult[]; error: string | null }

export async function searchSpotifyTracks(query: string): Promise<SpotifyTracksResult> {
  const res = await fetch(
    `${apiUrl}/api/v1/imports/spotify/search?q=${encodeURIComponent(query)}`,
    { headers: { Cookie: sessionHeader() }, cache: 'no-store' },
  )
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { tracks: [], error: (data as { error?: string }).error ?? 'Spotify search failed' }
  }
  const data = (await res.json()) as { tracks: SpotifyTrackResult[] }
  return { tracks: data.tracks, error: null }
}

export async function getSpotifyMyTracks(): Promise<SpotifyTracksResult & { artistId: string | null }> {
  const res = await fetch(`${apiUrl}/api/v1/imports/spotify/me-tracks`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return {
      tracks: [],
      artistId: null,
      error: (data as { error?: string }).error ?? 'Spotify lookup failed',
    }
  }
  const data = (await res.json()) as { artistId: string | null; tracks: SpotifyTrackResult[] }
  return { tracks: data.tracks, artistId: data.artistId, error: null }
}

export async function getSpotifyTracksByArtistUrl(artistUrl: string): Promise<SpotifyTracksResult> {
  const res = await fetch(
    `${apiUrl}/api/v1/imports/spotify/by-artist-url?artistUrl=${encodeURIComponent(artistUrl)}`,
    { headers: { Cookie: sessionHeader() }, cache: 'no-store' },
  )
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { tracks: [], error: (data as { error?: string }).error ?? 'Spotify lookup failed' }
  }
  const data = (await res.json()) as { tracks: SpotifyTrackResult[] }
  return { tracks: data.tracks, error: null }
}

export async function addSpotifyTrackToCollection(
  collectionId: string,
  spotifyUri: string,
): Promise<{
  error: string | null
  archiveItemId?: string
  collectionItemId?: string
  track?: SpotifyTrackResult
}> {
  const res = await fetch(`${apiUrl}/api/v1/imports/spotify/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ collectionId, spotifyUri }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to add Spotify track' }
  }
  const data = (await res.json()) as {
    archiveItemId: string
    collectionItemId: string
    track: SpotifyTrackResult
  }
  return { error: null, ...data }
}
