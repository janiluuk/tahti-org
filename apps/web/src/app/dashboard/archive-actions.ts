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

export async function updateArchiveMetadata(
  id: string,
  payload: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/archive/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to save metadata' }
  }
  return { error: null }
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
): Promise<{ error: string | null }> {
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
  return { error: null }
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

export async function fetchArchiveEditorSource(itemId: string): Promise<{
  url?: string
  durationSec?: number | null
  title?: string
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

export async function bounceArchiveTrim(
  itemId: string,
  body: {
    startSec: number
    endSec: number
    fadeInSec: number
    fadeOutSec: number
    peakNormalize: boolean
    lufsTarget?: 'none' | 'stream' | 'club'
    limiterEnabled?: boolean
    highPassHz?: number
    lowPassHz?: number
    eq?: { lowGainDb: number; midGainDb: number; highGainDb: number }
    compressorEnabled?: boolean
    versionLabel: string
    activate: boolean
  },
): Promise<{ versionId?: string; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/archive/${itemId}/editor/bounce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Bounce failed' }
  }
  const data = (await res.json()) as { versionId: string }
  return { versionId: data.versionId, error: null }
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
