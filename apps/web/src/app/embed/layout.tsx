// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'

// Minimal chrome for iframe embeds (M14) — no site footer or navigation.
export default function EmbedLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        margin: 0,
        padding: '0.75rem',
        fontFamily: 'system-ui, sans-serif',
        background: '#0f0f0f',
        color: '#f5f5f5',
        minHeight: '100%',
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  )
}
