// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { StudioSidebar } from './StudioSidebar'
import { StudioTopNav } from './StudioTopNav'

type StudioShellProps = {
  children: ReactNode
}

/** Dashboard shell — sidebar + top nav on @tahti/ui dark tokens. Import brand-studio.css on the route. */
export function StudioShell({ children }: StudioShellProps) {
  return (
    <div data-tahti-ui="studio" className="tahti-studio">
      <StudioTopNav />
      <div className="db-layout">
        <StudioSidebar />
        <main className="db-main">{children}</main>
      </div>
    </div>
  )
}
