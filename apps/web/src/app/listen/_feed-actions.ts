// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type { ArtistPostView } from '@tahti/shared'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const sessionCookie = cookies().get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export async function updateFeedPost(
  id: string,
  params: {
    title?: string | null
    body?: string
    linkUrl?: string | null
    linkLabel?: string | null
    publishAt?: string
  },
): Promise<{ error: string | null; post?: ArtistPostView }> {
  const res = await fetch(`${apiUrl}/api/me/posts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: (data as { error?: string }).error ?? 'Failed to save changes' }
  }
  revalidatePath('/listen')
  revalidatePath('/dashboard/posts')
  return { error: null, post: data as ArtistPostView }
}

export async function deleteFeedPost(id: string): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/posts/${id}`, {
    method: 'DELETE',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to delete post' }
  }
  revalidatePath('/listen')
  revalidatePath('/dashboard/posts')
  return { error: null }
}
