// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import '@/components/brand-studio.css'
import '@tahti/ui/src/tokens.css'
import '@tahti/ui/src/components.css'
import { StudioSidebar } from '@/components/studio/studio-sidebar'
import { StudioTopNav } from '@/components/studio/studio-top-nav'

type StudioShellProps = {
  children: ReactNode
}

/** PLAT-020: dashboard shell — sidebar + top nav on @tahti/ui dark tokens. */
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
