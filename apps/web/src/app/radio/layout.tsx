// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import '@tahti/ui/src/tokens.css'
import '@tahti/ui/src/components.css'
import '@tahti/ui/src/styles/brand-channel.css'

/** Radio page — channel shell with optional Three.js BgCanvas. */
export default function RadioLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-tahti-ui="brand"
      data-channel-root
      className="brand-channel brand-channel--canvas brand-channel--radio"
    >
      {children}
    </div>
  )
}
