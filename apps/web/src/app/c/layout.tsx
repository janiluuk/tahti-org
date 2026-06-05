// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import '@tahti/ui/src/tokens.css'
import '@tahti/ui/src/components.css'
import '@tahti/ui/src/styles/brand-channel.css'

/** Channel routes use @tahti/ui dark-brand styles (PLAT-020 phase 2). */
export default function ChannelLayout({ children }: { children: ReactNode }) {
  return (
    <div data-tahti-ui="brand" className="brand-channel">
      {children}
    </div>
  )
}
