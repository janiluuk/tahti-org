// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import type { ReactNode } from 'react'
import { StudioShell } from '@tahti/ui'
import '@tahti/ui/src/tokens.css'
import '@tahti/ui/src/components.css'
import '@tahti/ui/src/styles/brand-studio.css'

/** Dashboard uses StudioShell from @tahti/ui (import brand-studio.css once here). */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  let displayName: string | undefined
  let isLive = false

  try {
    const cookieStore = cookies()
    const sessionCookie = cookieStore.get('tahti_session')
    if (sessionCookie) {
      const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
      const res = await fetch(`${apiUrl}/api/auth/me`, {
        headers: { Cookie: `tahti_session=${sessionCookie.value}` },
        cache: 'no-store',
      })
      if (res.ok) {
        const user = (await res.json()) as {
          displayName: string
          channel?: { state: string } | null
        }
        displayName = user.displayName
        isLive = user.channel?.state === 'LIVE'
      }
    }
  } catch {
    // ignore — top nav just shows without user context
  }

  return (
    <StudioShell displayName={displayName} isLive={isLive}>
      {children}
    </StudioShell>
  )
}
