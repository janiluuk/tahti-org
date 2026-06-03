// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import '@/components/brand-studio.css'
import '@tahti/ui/src/tokens.css'
import '@tahti/ui/src/components.css'

type StudioShellProps = {
  children: ReactNode
}

/** PLAT-020: dashboard shell — @tahti/ui tokens on studio surfaces. */
export function StudioShell({ children }: StudioShellProps) {
  return (
    <div data-tahti-ui="studio" className="tahti-studio">
      {children}
    </div>
  )
}
