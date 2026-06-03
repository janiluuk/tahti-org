// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const sessionCookie = cookies().get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export async function castVote(
  motionId: string,
  choice: 'YES' | 'NO' | 'ABSTAIN',
): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/v1/governance/motions/${motionId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ choice }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to record vote' }
  }
  revalidatePath('/governance')
  return { error: null }
}

export async function transitionMotion(
  motionId: string,
  state: 'OPEN' | 'CLOSED',
): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/v1/governance/motions/${motionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify({ state }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to update motion' }
  }
  revalidatePath('/governance')
  return { error: null }
}

export async function createMotion(params: {
  title: string
  description: string
  openAt: string
  closeAt: string
}): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/v1/governance/motions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to create motion' }
  }
  revalidatePath('/governance')
  return { error: null }
}
