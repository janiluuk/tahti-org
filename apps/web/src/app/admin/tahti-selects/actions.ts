// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

function adminFetch(path: string, init?: RequestInit) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  return fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}`, ...(init?.headers ?? {}) },
  })
}

export async function addToRotation(archiveItemId: string) {
  await adminFetch('/api/admin/tahti-selects/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ archiveItemId }),
  })
  revalidatePath('/admin/tahti-selects')
}

export async function removeFromRotation(itemId: string) {
  await adminFetch(`/api/admin/tahti-selects/items/${itemId}`, { method: 'DELETE' })
  revalidatePath('/admin/tahti-selects')
}

export async function reorderItem(itemId: string, position: number) {
  await adminFetch(`/api/admin/tahti-selects/items/${itemId}/reorder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ position }),
  })
  revalidatePath('/admin/tahti-selects')
}

export async function startRotationStream(): Promise<{ error: string | null }> {
  const res = await adminFetch('/api/admin/tahti-selects/stream/start', { method: 'POST' })
  const data = await res.json().catch(() => ({}))
  revalidatePath('/admin/tahti-selects')
  if (!res.ok) return { error: (data as { error?: string }).error ?? 'Failed to start stream' }
  return { error: null }
}

export async function stopRotationStream(): Promise<{ error: string | null }> {
  const res = await adminFetch('/api/admin/tahti-selects/stream/stop', { method: 'POST' })
  const data = await res.json().catch(() => ({}))
  revalidatePath('/admin/tahti-selects')
  if (!res.ok) return { error: (data as { error?: string }).error ?? 'Failed to stop stream' }
  return { error: null }
}
