// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const sessionCookie = cookies().get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export async function registerVenue(formData: FormData): Promise<{ error: string | null }> {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) redirect('/login?next=/venues/register')

  const payload = {
    slug: String(formData.get('slug') ?? ''),
    name: String(formData.get('name') ?? ''),
    address: String(formData.get('address') ?? ''),
    city: String(formData.get('city') ?? ''),
    countryCode: String(formData.get('countryCode') ?? 'FI') || 'FI',
    description: String(formData.get('description') ?? '') || undefined,
    capacity: formData.get('capacity') ? Number(formData.get('capacity')) : undefined,
  }

  const res = await fetch(`${apiUrl}/api/v1/venues`, {
    method: 'POST',
    headers: {
      Cookie: sessionHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Registration failed' }
  }

  const venue = (await res.json()) as { slug: string }
  redirect(`/v/${venue.slug}?pending=1`)
}
