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

export async function suspendUser(
  userId: string,
  reason: string,
): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/admin/users/${userId}/suspend`, {
    method: 'POST',
    headers: { Cookie: sessionHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Suspend failed' }
  }
  revalidatePath(`/admin/users/${userId}`)
  revalidatePath('/admin/users')
  return { error: null }
}

export async function unsuspendUser(userId: string): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/admin/users/${userId}/unsuspend`, {
    method: 'POST',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Unsuspend failed' }
  }
  revalidatePath(`/admin/users/${userId}`)
  revalidatePath('/admin/users')
  return { error: null }
}

export async function toggleBoardRole(
  userId: string,
  isBoard: boolean,
): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/admin/users/${userId}`, {
    method: 'PATCH',
    headers: { Cookie: sessionHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ isBoard }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Update failed' }
  }
  revalidatePath(`/admin/users/${userId}`)
  revalidatePath('/admin/users')
  return { error: null }
}
