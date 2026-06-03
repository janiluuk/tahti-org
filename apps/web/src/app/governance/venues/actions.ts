// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export interface AdminVenueRow {
  id: string
  slug: string
  name: string
  city: string | null
  countryCode: string | null
  verifiedAt: string | null
  createdAt: string
}

export async function fetchAdminVenues(): Promise<{
  venues?: AdminVenueRow[]
  error: string | null
}> {
  const res = await fetch(`${apiUrl}/api/admin/venues`, {
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Failed to load venues' }
  }
  return { venues: await res.json(), error: null }
}

export async function verifyVenue(slug: string): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/admin/venues/${slug}/verify`, {
    method: 'POST',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Verify failed' }
  }
  revalidatePath('/governance/venues')
  return { error: null }
}

export async function unverifyVenue(slug: string): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/admin/venues/${slug}/unverify`, {
    method: 'POST',
    headers: { Cookie: sessionHeader() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Unverify failed' }
  }
  revalidatePath('/governance/venues')
  return { error: null }
}
