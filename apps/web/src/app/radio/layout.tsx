// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { PublicFooter } from '@tahti/ui'
import '@tahti/ui/src/tokens.css'
import '@tahti/ui/src/components.css'
import '@tahti/ui/src/styles/brand-channel.css'
import '@tahti/ui/src/styles/shells.css'
import { statusPageUrl } from '@/lib/status-page'

/** Radio — shell-public page content. The gateway background (<BgCanvas>, with
 * the audio analyser hooked up) is NOT rendered here — it's a single persistent
 * instance shared across all public-nav routes (see PublicNavBg in the root
 * layout) so navigating between them doesn't reinitialize the WebGL scene. */
export default function RadioLayout({ children }: { children: ReactNode }) {
  return (
    <div data-tahti-ui="brand" className="brand-channel brand-channel--radio shell-public">
      <div className="radio-shell">
        <div className="shell-public__inner">{children}</div>
        <PublicFooter statusUrl={statusPageUrl()} />
      </div>
    </div>
  )
}
