// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const cookieStore = cookies()
  const s = cookieStore.get('tahti_session')
  return s ? `tahti_session=${s.value}` : ''
}

export async function updateChannelProfile(patch: {
  displayName?: string
  bio?: string
  avatarUrl?: string
  countryCode?: string | null
  socialLinks?: Record<string, string>
}): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(patch),
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    return { error: body.error ?? 'Failed to save' }
  }
  return { error: null }
}
