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

export async function fetchMixcloudStatus(): Promise<{
  connected: boolean
  configured: boolean
  error: string | null
}> {
  const res = await fetch(`${apiUrl}/api/me/mixcloud`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    return { connected: false, configured: false, error: 'Failed to load Mixcloud status' }
  }
  const data = (await res.json()) as { connected: boolean; configured: boolean }
  return { ...data, error: null }
}

export async function disconnectMixcloud(): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/mixcloud`, {
    method: 'DELETE',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Disconnect failed' }
  }
  return { error: null }
}

export async function queueMixcloudUpload(
  archiveItemId: string,
): Promise<{ error: string | null; status?: string; mixcloudUrl?: string }> {
  const res = await fetch(`${apiUrl}/api/me/archive/${archiveItemId}/mixcloud`, {
    method: 'POST',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: (data as { error?: string }).error ?? 'Upload queue failed' }
  }
  return { error: null, status: (data as { status?: string }).status }
}

export async function fetchMixcloudUploadStatus(archiveItemId: string): Promise<{
  error: string | null
  status?: string
  mixcloudUrl?: string | null
}> {
  const res = await fetch(`${apiUrl}/api/me/archive/${archiveItemId}/mixcloud`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 404) return { error: null, status: undefined }
    return { error: (data as { error?: string }).error ?? 'Status check failed' }
  }
  return {
    error: null,
    status: (data as { status?: string }).status,
    mixcloudUrl: (data as { mixcloudUrl?: string }).mixcloudUrl,
  }
}
