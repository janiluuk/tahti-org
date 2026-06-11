// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { PublicFooter } from '@tahti/ui'
import '@tahti/ui/src/tokens.css'
import '@tahti/ui/src/components.css'
import '@tahti/ui/src/styles/brand-channel.css'
import { BgCanvas } from '@/components/ui/bg-canvas'

/** Radio — same public brand shell as Home / Discover, with dimmed gateway background. */
export default function RadioLayout({ children }: { children: ReactNode }) {
  return (
    <div data-tahti-ui="brand" className="brand-channel brand-channel--radio">
      <BgCanvas variant="subtle" />
      <div className="radio-shell">
        {children}
        <PublicFooter />
      </div>
    </div>
  )
}
