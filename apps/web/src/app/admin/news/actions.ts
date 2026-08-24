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

export async function createNewsPost(params: {
  headline: string
  summary: string
  publish?: boolean
}): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/admin/news`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Create failed' }
  }
  revalidatePath('/admin/news')
  return { error: null }
}

export async function updateNewsPost(
  id: string,
  params: { headline?: string; summary?: string; publish?: boolean },
): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/admin/news/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Update failed' }
  }
  revalidatePath('/admin/news')
  return { error: null }
}

export async function deleteNewsPost(id: string): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/admin/news/${id}`, {
    method: 'DELETE',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Delete failed' }
  }
  revalidatePath('/admin/news')
  return { error: null }
}

export async function sendTestNotification(params: {
  targetUsername: string
  title: string
  body?: string
  url?: string
}): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/admin/notifications/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Send failed' }
  }
  return { error: null }
}
