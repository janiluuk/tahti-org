// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'

export interface SessionUser {
  username: string
  displayName: string
}

/** Best-effort lookup of the current session user for server components.
 *  Returns null when not logged in or when the API call fails — callers
 *  should treat this as "render the anonymous view", not redirect. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) return null

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { Cookie: `tahti_session=${sessionCookie.value}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = (await res.json()) as { username: string; displayName: string }
    return { username: data.username, displayName: data.displayName }
  } catch {
    return null
  }
}
