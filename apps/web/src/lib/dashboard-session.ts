// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cache } from 'react'
import { cookies } from 'next/headers'

export interface DashboardUser {
  id: string
  email: string
  username: string
  displayName: string
  avatarUrl: string | null
  tier: string
  emailVerifiedAt: string | null
  isMember: boolean
  isBoard: boolean
  membership: { status: string; activatedAt: string | null } | null
  channel: {
    slug: string
    state: string
    goneLiveAt: string | null
    customDomain: string | null
    customDomainVerified: boolean
  } | null
  storage: { usedBytes: string; softTargetBytes?: string; showSoftTarget: boolean } | null
}

/** Dedupe `/api/auth/me` between dashboard layout and page within one request. */
export const getDashboardUser = cache(async (): Promise<DashboardUser | null> => {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) return null

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { Cookie: `tahti_session=${sessionCookie.value}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as DashboardUser
  } catch {
    return null
  }
})

export function dashboardSessionCookie(): string | undefined {
  return cookies().get('tahti_session')?.value
}
