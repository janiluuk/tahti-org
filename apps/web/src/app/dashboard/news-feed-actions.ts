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

export async function updateNewsFeedUrl(
  newsFeedUrl: string,
): Promise<{ error: string | null; newsFeedUrl?: string | null }> {
  const response = await fetch(`${apiUrl}/api/me/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ newsFeedUrl }),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return { error: (data as { error?: string }).error ?? 'Failed to save' }
  }
  return { error: null, newsFeedUrl: (data as { newsFeedUrl: string | null }).newsFeedUrl }
}

/** Fetches the raw feed document server-side (through the SSRF-guarded proxy,
 * with the artist's own session) so the settings panel can preview it —
 * parsing happens client-side with the browser's native DOMParser. */
export async function previewNewsFeedXml(
  url: string,
): Promise<{ error: string | null; xml?: string }> {
  const response = await fetch(`${apiUrl}/api/me/rss-feed?url=${encodeURIComponent(url)}`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return { error: (data as { error?: string }).error ?? 'Could not load that feed' }
  }
  return { error: null, xml: (data as { xml: string }).xml }
}
