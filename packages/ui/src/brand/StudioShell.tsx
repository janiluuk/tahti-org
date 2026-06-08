// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { StudioSidebar } from './StudioSidebar'
import { StudioTopNav } from './StudioTopNav'
import { StudioMobileNav } from './StudioMobileNav'

type StudioShellProps = {
  children: ReactNode
  displayName?: string
  isLive?: boolean
  isBoard?: boolean
}

/** Dashboard shell — sidebar + top nav on @tahti/ui dark tokens. Import brand-studio.css on the route. */
export function StudioShell({ children, displayName, isLive, isBoard }: StudioShellProps) {
  return (
    <div data-tahti-ui="studio" className="tahti-studio">
      <StudioTopNav displayName={displayName} isLive={isLive} isBoard={isBoard} />
      <div className="db-layout">
        <StudioSidebar isBoard={isBoard} />
        <main className="db-main">{children}</main>
      </div>
      <StudioMobileNav />
    </div>
  )
}
