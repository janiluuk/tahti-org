// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { ChannelHeader } from '@tahti/ui'
import '@tahti/ui/src/tokens.css'
import '@tahti/ui/src/styles/brand-channel.css'
import '@tahti/ui/src/styles/brand-public.css'

export default function InfoLayout({ children }: { children: ReactNode }) {
  return (
    <div data-tahti-ui="brand" className="info-shell">
      <ChannelHeader />
      {children}
    </div>
  )
}
