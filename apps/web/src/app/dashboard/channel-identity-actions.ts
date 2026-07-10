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
  pronouns?: string | null
  defaultLocation?: string | null
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

export async function prepareAvatarUpload(body: {
  filename: string
  contentType: string
}): Promise<{ uploadKey?: string; uploadUrl?: string; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/profile/avatar/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { error: data.error ?? 'Prepare failed' }
  }
  return { ...(await res.json()), error: null }
}

export async function completeAvatarUpload(
  uploadKey: string,
): Promise<{ avatarUrl?: string | null; error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/profile/avatar/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ uploadKey }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    return { error: data.error ?? 'Upload failed' }
  }
  return { ...(await res.json()), error: null }
}
