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
