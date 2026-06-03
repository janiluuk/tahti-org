// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'

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
