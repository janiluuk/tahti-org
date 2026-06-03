// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import '@/components/brand-public.css'
import '@tahti/ui/src/components.css'

/** Minimal chrome for iframe embeds (M14) — brand tokens, no site nav. */
export default function EmbedLayout({ children }: { children: ReactNode }) {
  return (
    <div data-tahti-ui="brand" className="embed-chrome">
      {children}
    </div>
  )
}
