// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use server'

import { applySessionCookieFromResponse } from '@/lib/apply-session-cookie'

const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

export async function resetPassword(input: {
  token: string
  password: string
}): Promise<{ error: string | null }> {
  const res = await fetch(`${apiUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { error: (data as { error?: string }).error ?? 'Could not reset password' }
  }

  applySessionCookieFromResponse(res)

  return { error: null }
}
