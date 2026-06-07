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

export interface ModeratorRow {
  userId: string
  username: string
  displayName: string
  grantedAt: string
}

export async function addModerator(
  username: string,
): Promise<{ error: string | null; moderator?: ModeratorRow }> {
  const response = await fetch(`${apiUrl}/api/me/channel/moderators`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ username }),
    cache: 'no-store',
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to add moderator' }
  }
  return { error: null, moderator: (await response.json()) as ModeratorRow }
}

export async function removeModerator(userId: string): Promise<{ error: string | null }> {
  const response = await fetch(
    `${apiUrl}/api/me/channel/moderators/${encodeURIComponent(userId)}`,
    { method: 'DELETE', headers: { Cookie: sessionHeader() }, cache: 'no-store' },
  )
  if (!response.ok && response.status !== 204) {
    return { error: 'Failed to remove moderator' }
  }
  return { error: null }
}

export async function banChatFingerprint(
  slug: string,
  fingerprintHash: string,
): Promise<{ error: string | null }> {
  const response = await fetch(`${apiUrl}/api/me/moderate/${encodeURIComponent(slug)}/chat/ban`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ fingerprintHash }),
    cache: 'no-store',
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to ban' }
  }
  return { error: null }
}

export async function unbanChatFingerprint(
  slug: string,
  fingerprintHash: string,
): Promise<{ error: string | null }> {
  const response = await fetch(
    `${apiUrl}/api/me/moderate/${encodeURIComponent(slug)}/chat/ban/${encodeURIComponent(fingerprintHash)}`,
    { method: 'DELETE', headers: { Cookie: sessionHeader() }, cache: 'no-store' },
  )
  if (!response.ok && response.status !== 204) {
    const data = await response.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to unban' }
  }
  return { error: null }
}
