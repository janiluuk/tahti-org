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
    cache: 'no-store',
  })
}

export async function approveRadioSubmission(id: string): Promise<{ error: string | null }> {
  const res = await adminFetch(`/api/admin/radio-submissions/${id}/approve`, { method: 'POST' })
  const data = await res.json().catch(() => ({}))
  revalidatePath('/admin/radio-submissions')
  if (!res.ok) return { error: (data as { error?: string }).error ?? 'Approve failed' }
  return { error: null }
}

export async function rejectRadioSubmission(
  id: string,
  rejectionNote?: string,
): Promise<{ error: string | null; notified?: boolean }> {
  const res = await adminFetch(`/api/admin/radio-submissions/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rejectionNote: rejectionNote?.trim() || undefined }),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string; notified?: boolean }
  revalidatePath('/admin/radio-submissions')
  if (!res.ok) return { error: data.error ?? 'Reject failed' }
  return { error: null, notified: data.notified }
}
