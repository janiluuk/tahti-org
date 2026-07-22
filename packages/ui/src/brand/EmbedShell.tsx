// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'

type EmbedShellProps = {
  children: ReactNode
  /** Drop the brand dark fill so the embed blends into the host page's own background. */
  transparent?: boolean
}

/** Minimal dark chrome for iframe embeds — import embed.css on the route layout. */
export function EmbedShell({ children, transparent = false }: EmbedShellProps) {
  return (
    <div data-tahti-ui="embed" className="tahti-embed" data-bg={transparent ? 'transparent' : undefined}>
      {children}
    </div>
  )
}
