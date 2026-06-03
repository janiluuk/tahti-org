// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import '@tahti/ui/src/tokens.css'
import '@tahti/ui/src/components.css'
import '@/components/brand-studio.css'

/** PLAT-020: studio shell uses @tahti/ui tokens (dashboard + authenticated studio). */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div data-tahti-ui="studio" className="tahti-studio">
      {children}
    </div>
  )
}
