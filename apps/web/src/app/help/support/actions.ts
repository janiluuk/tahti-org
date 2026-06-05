// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

function sessionHeader() {
  const sessionCookie = cookies().get('tahti_session')
  return sessionCookie ? `tahti_session=${sessionCookie.value}` : ''
}

export async function submitSupportContact(formData: FormData): Promise<{ error: string | null }> {
  const payload = {
    subject: String(formData.get('subject') ?? ''),
    message: String(formData.get('message') ?? ''),
    category: String(formData.get('category') ?? 'OTHER'),
    contactEmail: String(formData.get('contactEmail') ?? '') || undefined,
  }

  const res = await fetch(`${apiUrl}/api/support/contact`, {
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
    return { error: (data as { error?: string }).error ?? 'Could not send message' }
  }

  return { error: null }
}
