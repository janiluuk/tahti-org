// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const sessionCookie = cookies().get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export async function saveMastodonSocial(input: {
  instanceUrl: string
  accessToken: string
  onReleasePublished: boolean
  onChannelLive: boolean
  postTemplate: string
}): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/social/mastodon`, {
    method: 'PUT',
    headers: { Cookie: sessionHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Could not save Mastodon settings' }
  }
  revalidatePath('/dashboard')
  return { error: null }
}

export async function disconnectMastodon(): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/social/mastodon`, {
    method: 'DELETE',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Disconnect failed' }
  }
  revalidatePath('/dashboard')
  return { error: null }
}

export async function postSocialManual(message: string): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/social/post`, {
    method: 'POST',
    headers: { Cookie: sessionHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Post failed' }
  }
  revalidatePath('/dashboard')
  return { error: null }
}
