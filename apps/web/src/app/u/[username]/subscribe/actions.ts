// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

export async function subscribe(
  username: string,
  tierId: string,
): Promise<{ error: string | null; checkoutUrl?: string; activated?: boolean }> {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) {
    return { error: 'Please log in to subscribe.' }
  }

  const res = await fetch(`${apiUrl}/api/v1/u/${encodeURIComponent(username)}/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `tahti_session=${sessionCookie.value}`,
    },
    body: JSON.stringify({ tierId }),
    cache: 'no-store',
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: (data as { error?: string }).error ?? 'Could not subscribe' }
  }
  return {
    error: null,
    checkoutUrl: (data as { checkoutUrl?: string }).checkoutUrl,
    activated: (data as { activated?: boolean }).activated,
  }
}
