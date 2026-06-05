// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import '@tahti/ui/src/styles/brand-public.css'

export default function TransparencyLayout({ children }: { children: ReactNode }) {
  return (
    <div data-tahti-ui="brand" className="brand-public">
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1rem' }}>{children}</div>
    </div>
  )
}
