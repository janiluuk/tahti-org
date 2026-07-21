// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { PublicFooter } from '@tahti/ui'
import '@tahti/ui/src/tokens.css'
import '@tahti/ui/src/components.css'
import '@tahti/ui/src/styles/brand-channel.css'
import '@tahti/ui/src/styles/shells.css'
import { statusPageUrl } from '@/lib/status-page'
import { RadioBgCanvas } from './radio-bg-canvas'

/** Radio — shell-public page content with dimmed gateway background. */
export default function RadioLayout({ children }: { children: ReactNode }) {
  return (
    <div data-tahti-ui="brand" className="brand-channel brand-channel--radio shell-public">
      <RadioBgCanvas />
      <div className="radio-shell">
        <div className="shell-public__inner">{children}</div>
        <PublicFooter statusUrl={statusPageUrl()} />
      </div>
    </div>
  )
}
