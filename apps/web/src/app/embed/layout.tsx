// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import '@tahti/ui/src/styles/brand-public.css'

// Minimal chrome for iframe embeds (M14) — no site footer or navigation.
export default function EmbedLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-tahti-ui="public"
      style={{
        margin: 0,
        padding: '0.75rem',
        minHeight: '100%',
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  )
}
