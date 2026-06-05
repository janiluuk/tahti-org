// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { cookies } from 'next/headers'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

export async function setupPassword(input: {
  token: string
  password: string
}): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/auth/setup-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Could not set password' }
  }

  const setCookieHeader = res.headers.get('set-cookie') ?? ''
  const match = setCookieHeader.match(/tahti_session=([^;]+)/)
  if (match) {
    cookies().set({
      name: 'tahti_session',
      value: match[1],
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    })
  }

  return { error: null }
}
