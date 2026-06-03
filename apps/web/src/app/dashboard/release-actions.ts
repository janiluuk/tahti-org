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

export async function createRelease(params: {
  title: string
  type: string
  releaseDate: string
  description?: string
  tracks?: Array<{ title: string; durationSec?: number; archiveItemId?: string }>
}): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/releases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to create release' }
  }
  return { error: null }
}

export async function publishRelease(id: string): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/releases/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ state: 'PUBLISHED' }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to publish' }
  }
  return { error: null }
}
