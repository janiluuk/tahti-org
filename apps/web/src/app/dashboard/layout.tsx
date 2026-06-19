// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { StudioShell } from '@tahti/ui'
import '@tahti/ui/src/tokens.css'
import '@tahti/ui/src/components.css'
import '@tahti/ui/src/styles/brand-studio.css'
import '@tahti/ui/src/styles/shells.css'
import { getDashboardUser } from '@/lib/dashboard-session'

/** Dashboard uses StudioShell from @tahti/ui (import brand-studio.css once here). */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getDashboardUser()
  const displayName = user?.displayName
  const isLive = user?.channel?.state === 'LIVE'
  const isBoard = user?.isBoard ?? false
  const hasChannel = Boolean(user?.channel)

  return (
    <StudioShell
      displayName={displayName}
      isLive={isLive}
      isBoard={isBoard}
      hasChannel={hasChannel}
    >
      {children}
    </StudioShell>
  )
}
