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

export async function prepareArchiveBannerUpload(
  itemId: string,
  body: { filename: string; contentType: string },
): Promise<{ uploadKey?: string; uploadUrl?: string; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/archive/${itemId}/banner/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Prepare failed' }
  }
  return { ...(await res.json()), error: null }
}

export async function completeArchiveBannerUpload(
  itemId: string,
  uploadKey: string,
): Promise<{ url?: string | null; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/archive/${itemId}/banner/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ uploadKey }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Upload failed' }
  }
  return { ...(await res.json()), error: null }
}

export async function fetchArchiveBannerFromUrl(
  itemId: string,
  sourceUrl: string,
): Promise<{ url?: string | null; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/archive/${itemId}/banner/from-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ sourceUrl }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Fetch failed' }
  }
  return { ...(await res.json()), error: null }
}

export async function deleteArchiveItem(id: string): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/archive/${id}`, {
    method: 'DELETE',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to delete item' }
  }
  return { error: null }
}

export async function updateArchiveMetadata(
  id: string,
  payload: Record<string, unknown>,
): Promise<{
  error: string | null
  oldestFallbackItem?: { id: string; title: string } | null
}> {
  const res = await fetch(`${apiUrl}/api/me/archive/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const body = data as { error?: string; oldestItem?: { id: string; title: string } | null }
    return {
      error: body.error ?? 'Failed to save metadata',
      oldestFallbackItem: body.oldestItem,
    }
  }
  return { error: null }
}

export interface VenuePickerOption {
  id: string
  slug: string
  name: string
  city: string
  countryCode: string
}

export async function fetchMyDefaultLocation(): Promise<string | null> {
  const res = await fetch(`${apiUrl}/api/me/profile`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const data = (await res.json().catch(() => ({}))) as { defaultLocation?: string | null }
  return data.defaultLocation ?? null
}

export async function fetchVenuesForPicker(): Promise<VenuePickerOption[]> {
  const [mineRes, publicRes] = await Promise.all([
    fetch(`${apiUrl}/api/me/venues`, { headers: { Cookie: sessionHeader() }, cache: 'no-store' }),
    fetch(`${apiUrl}/api/v1/venues`, { cache: 'no-store' }),
  ])
  const mine = mineRes.ok ? ((await mineRes.json()) as VenuePickerOption[]) : []
  const pub = publicRes.ok ? ((await publicRes.json()) as VenuePickerOption[]) : []
  const byId = new Map<string, VenuePickerOption>()
  for (const v of [...mine, ...pub]) byId.set(v.id, v)
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function slugifyVenueName(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'venue'
  )
}

export async function createVenueQuick(params: {
  name: string
  address: string
  city: string
  countryCode?: string
  latitude?: number
  longitude?: number
  photos?: string[]
}): Promise<{ error: string | null; venue?: VenuePickerOption }> {
  const res = await fetch(`${apiUrl}/api/v1/venues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({
      ...params,
      slug: `${slugifyVenueName(params.name)}-${Date.now().toString(36)}`,
    }),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: (data as { error?: string }).error ?? 'Failed to create venue' }
  }
  return { error: null, venue: data as VenuePickerOption }
}

export async function searchTahtiUsers(
  q: string,
): Promise<Array<{ username: string; displayName: string }>> {
  if (q.trim().length < 2) return []
  const res = await fetch(`${apiUrl}/api/me/users/search?q=${encodeURIComponent(q.trim())}`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) return []
  return res.json()
}

export async function fetchArchiveVersions(
  itemId: string,
): Promise<{ versions?: import('@tahti/shared').ArchiveVersionRow[]; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/archive/${itemId}/versions`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to load versions' }
  }
  return { versions: await res.json(), error: null }
}

export async function prepareArchiveVersionUpload(
  itemId: string,
  body: { filename: string; contentType: string },
): Promise<{ uploadId?: string; uploadUrl?: string; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/archive/${itemId}/versions/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Prepare failed' }
  }
  return { ...(await res.json()), error: null }
}

export async function completeArchiveVersionUpload(
  itemId: string,
  body: { uploadId: string; versionLabel: string; fileSizeBytes?: number },
): Promise<{ versionId?: string; versionNumber?: number; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/archive/${itemId}/versions/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Complete failed' }
  }
  const data = (await res.json()) as { versionId: string; versionNumber: number }
  return { versionId: data.versionId, versionNumber: data.versionNumber, error: null }
}

export async function activateArchiveVersion(
  itemId: string,
  versionId: string,
): Promise<{ versions?: import('@tahti/shared').ArchiveVersionRow[]; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/archive/${itemId}/versions/${versionId}/activate`, {
    method: 'POST',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Activate failed' }
  }
  return { versions: await res.json(), error: null }
}

export async function fetchArchiveEditListDraft(itemId: string): Promise<{
  editList?: import('@tahti/audio-edit').EditList
  updatedAt?: string | null
  tracklist?: import('@tahti/shared').TracklistEntry[] | null
  editorPeaks?: import('@tahti/audio-edit').PeaksPyramid | null
  error: string | null
}> {
  const res = await fetch(`${apiUrl}/api/me/archive/${itemId}/editor/draft`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to load edit draft' }
  }
  const data = (await res.json()) as {
    editList: import('@tahti/audio-edit').EditList
    updatedAt: string | null
    tracklist?: import('@tahti/shared').TracklistEntry[] | null
    editorPeaks?: import('@tahti/audio-edit').PeaksPyramid | null
  }
  return {
    editList: data.editList,
    updatedAt: data.updatedAt,
    tracklist: data.tracklist ?? null,
    editorPeaks: data.editorPeaks ?? null,
    error: null,
  }
}

export async function saveArchiveEditListDraft(
  itemId: string,
  editList: import('@tahti/audio-edit').EditList,
  expectedUpdatedAt?: string | null,
): Promise<{ updatedAt?: string; error: string | null; conflict?: boolean }> {
  const res = await fetch(`${apiUrl}/api/me/archive/${itemId}/editor/draft`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({
      editList,
      ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
    }),
    cache: 'no-store',
  })
  if (res.status === 409) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; updatedAt?: string }
    return {
      error: data.error ?? 'Draft conflict',
      updatedAt: data.updatedAt,
      conflict: true,
    }
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to save edit draft' }
  }
  const data = (await res.json()) as { updatedAt: string }
  return { updatedAt: data.updatedAt, error: null }
}

export async function renderArchiveEditList(
  itemId: string,
  body: {
    editList: import('@tahti/audio-edit').EditList
    versionLabel: string
    activate?: boolean
    format?: 'flac' | 'mp3' | 'wav'
    maxDurationSec?: number
    sampleOnly?: boolean
  },
): Promise<{ versionId?: string; versionNumber?: number; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/archive/${itemId}/editor/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Server render failed' }
  }
  const data = (await res.json()) as { versionId: string; versionNumber: number }
  return { versionId: data.versionId, versionNumber: data.versionNumber, error: null }
}

export async function fetchArchiveVersionDownloadUrl(
  itemId: string,
  versionId: string,
): Promise<{ url?: string; contentType?: string; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/archive/${itemId}/versions/${versionId}/download`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Download not available' }
  }
  const data = (await res.json()) as { url: string; contentType: string }
  return { url: data.url, contentType: data.contentType, error: null }
}

export async function fetchArchiveVersion(
  itemId: string,
  versionId: string,
): Promise<{ version?: import('@tahti/shared').ArchiveVersionRow; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/archive/${itemId}/versions/${versionId}`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to load version' }
  }
  return { version: await res.json(), error: null }
}

export async function waitForArchiveVersionReady(
  itemId: string,
  versionId: string,
  maxAttempts = 90,
): Promise<{
  ready: boolean
  version?: import('@tahti/shared').ArchiveVersionRow
  error: string | null
}> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetchArchiveVersion(itemId, versionId)
    if (res.error) return { ready: false, error: res.error }
    if (res.version?.status === 'READY') return { ready: true, version: res.version, error: null }
    if (res.version?.status === 'ERROR') return { ready: false, error: 'Render failed on server' }
    await new Promise((r) => setTimeout(r, 2000))
  }
  return { ready: false, error: 'Render timed out' }
}

export async function fetchArchiveEditorSource(itemId: string): Promise<{
  url?: string
  durationSec?: number | null
  title?: string
  sourceKey?: string
  sourceFileSizeBytes?: number | null
  error: string | null
}> {
  const res = await fetch(`${apiUrl}/api/me/archive/${itemId}/editor/source`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to load editor source' }
  }
  return { ...(await res.json()), error: null }
}

export async function fetchReleasesForPublish(): Promise<{
  releases?: Array<{ id: string; title: string }>
  error: string | null
}> {
  const res = await fetch(`${apiUrl}/api/me/releases`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to load releases' }
  }
  const releases = (await res.json()) as Array<{ id: string; title: string }>
  return { releases: releases.map((r) => ({ id: r.id, title: r.title })), error: null }
}

export async function publishArchiveToRelease(
  itemId: string,
  body: { releaseId: string; versionId?: string; title?: string },
): Promise<{ trackId?: string; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/archive/${itemId}/editor/publish-to-release`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Publish failed' }
  }
  const data = (await res.json()) as { trackId: string }
  return { trackId: data.trackId, error: null }
}

export async function fetchDownloadGateStats(itemId: string): Promise<{
  stats?: {
    artistFollowerCount: number
    repostAckCount: number
    blockedDownloadAttempts: number
    countedDownloadCount: number
  }
  error: string | null
}> {
  const res = await fetch(`${apiUrl}/api/me/archive/${itemId}/download-gate-stats`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to load gate stats' }
  }
  return { stats: await res.json(), error: null }
}
