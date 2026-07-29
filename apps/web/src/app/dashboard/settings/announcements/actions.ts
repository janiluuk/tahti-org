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

export interface AnnouncementClipRow {
  id: string
  title: string
  durationSec: number | null
  isEnabled: boolean
  scheduleMode: string
  everyNth: number | null
  position: number
  renderStatus: 'READY' | 'PROCESSING' | 'ERROR'
  createdAt: string
}

export async function fetchMyAnnouncements(): Promise<{
  clips: AnnouncementClipRow[]
  error: string | null
}> {
  const res = await fetch(`${apiUrl}/api/me/announcements`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) return { clips: [], error: 'Failed to load announcements' }
  const data = (await res.json()) as { clips: AnnouncementClipRow[] }
  return { clips: data.clips, error: null }
}

export async function prepareAnnouncementUpload(
  filename: string,
  contentType: string,
  fileSizeBytes: number,
  title: string,
): Promise<{ uploadId: string; uploadUrl: string } | { error: string }> {
  const res = await fetch(`${apiUrl}/api/me/announcements/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ filename, contentType, fileSizeBytes, title }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Could not start upload' }
  }
  const data = (await res.json()) as { uploadId: string; uploadUrl: string }
  return { uploadId: data.uploadId, uploadUrl: data.uploadUrl }
}

export async function completeAnnouncementUpload(
  uploadId: string,
  title: string,
  durationSec?: number,
): Promise<{ clip: AnnouncementClipRow | null; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/announcements/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ uploadId, title, durationSec }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return {
      clip: null,
      error: (data as { error?: string }).error ?? 'Could not save announcement',
    }
  }
  return { clip: (await res.json()) as AnnouncementClipRow, error: null }
}

export async function toggleAnnouncementEnabled(
  id: string,
  isEnabled: boolean,
): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/announcements/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ isEnabled }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Could not save' }
  }
  return { error: null }
}

export async function deleteAnnouncement(id: string): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/announcements/${id}`, {
    method: 'DELETE',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok && res.status !== 404) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Could not delete' }
  }
  return { error: null }
}

export interface AnnouncementEditorSource {
  url: string
  originalUrl: string
  durationSec: number | null
  title: string
  renderStatus: 'READY' | 'PROCESSING' | 'ERROR'
}

export async function fetchAnnouncementEditorSource(
  id: string,
): Promise<AnnouncementEditorSource | { error: string }> {
  const res = await fetch(`${apiUrl}/api/me/announcements/${id}/editor/source`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) return { error: 'Could not load audio' }
  return (await res.json()) as AnnouncementEditorSource
}

export async function renderAnnouncementTrim(
  id: string,
  patch: { startSec: number; endSec: number; fadeInSec: number; fadeOutSec: number },
): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/announcements/${id}/editor/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(patch),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Could not save edit' }
  }
  return { error: null }
}
