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

export async function createPost(params: {
  title?: string
  body: string
  linkUrl?: string
  linkLabel?: string
  publishAt?: string
}): Promise<{ error: string | null; post?: ArtistPostView }> {
  const res = await fetch(`${apiUrl}/api/me/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: (data as { error?: string }).error ?? 'Failed to publish post' }
  }
  revalidatePath('/dashboard/posts')
  return { error: null, post: data as ArtistPostView }
}

export async function deletePost(id: string): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/posts/${id}`, {
    method: 'DELETE',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to delete post' }
  }
  revalidatePath('/dashboard/posts')
  return { error: null }
}

export async function preparePostImageUpload(
  postId: string,
  filename: string,
  contentType: string,
): Promise<{ error: string | null; uploadKey?: string; uploadUrl?: string }> {
  const res = await fetch(`${apiUrl}/api/me/posts/${postId}/images/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ filename, contentType }),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: (data as { error?: string }).error ?? 'Failed to prepare image upload' }
  }
  const body = data as { uploadKey: string; uploadUrl: string }
  return { error: null, uploadKey: body.uploadKey, uploadUrl: body.uploadUrl }
}

export async function completePostImageUpload(
  postId: string,
  uploadKey: string,
): Promise<{ error: string | null; post?: ArtistPostView }> {
  const res = await fetch(`${apiUrl}/api/me/posts/${postId}/images/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ uploadKey }),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: (data as { error?: string }).error ?? 'Failed to attach image' }
  }
  revalidatePath('/dashboard/posts')
  return { error: null, post: data as ArtistPostView }
}
