// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import '@tahti/ui/src/styles/brand-public.css'

export default function VerifyLayout({ children }: { children: ReactNode }) {
  return (
    <div data-tahti-ui="brand" className="brand-public brand-public--center">
      {children}
    </div>
  )
}
