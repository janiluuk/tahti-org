// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import type { ArtistEventView } from '@tahti/shared'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const sessionCookie = cookies().get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export async function createEvent(params: {
  title: string
  place: string
  location: string
  eventUrl?: string
  startAt: string
}): Promise<{ error: string | null; event?: ArtistEventView }> {
  const res = await fetch(`${apiUrl}/api/me/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: sessionHeader() },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: (data as { error?: string }).error ?? 'Failed to add event' }
  }
  revalidatePath('/dashboard/events')
  return { error: null, event: data as ArtistEventView }
}

export async function deleteEvent(id: string): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/me/events/${id}`, {
    method: 'DELETE',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to remove event' }
  }
  revalidatePath('/dashboard/events')
  return { error: null }
}
