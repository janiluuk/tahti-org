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

export async function updateTopListsOptOut(
  topListsOptOut: boolean,
): Promise<{ error: string | null; topListsOptOut?: boolean }> {
  const response = await fetch(`${apiUrl}/api/me/top-lists-opt-out`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ topListsOptOut }),
    cache: 'no-store',
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to save' }
  }
  const data = (await response.json()) as { topListsOptOut: boolean }
  return { error: null, topListsOptOut: data.topListsOptOut }
}
