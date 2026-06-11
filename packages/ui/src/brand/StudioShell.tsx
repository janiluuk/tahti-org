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

/** Production v8 dashboard layout (studio surface). Playground preview: DashboardShell. */
export function StudioShell({ children, displayName, isLive, isBoard }: StudioShellProps) {
  return (
    <div data-tahti-ui="studio" className="tahti-studio">
      <StudioTopNav displayName={displayName} isLive={isLive} isBoard={isBoard} />
      <div className="db-layout shell-app">
        <StudioSidebar isBoard={isBoard} />
        <main className="db-main shell-app__content">{children}</main>
      </div>
      <StudioMobileNav />
    </div>
  )
}
