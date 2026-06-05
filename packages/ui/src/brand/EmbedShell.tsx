// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'

type EmbedShellProps = {
  children: ReactNode
}

/** Minimal dark chrome for iframe embeds — import embed.css on the route layout. */
export function EmbedShell({ children }: EmbedShellProps) {
  return (
    <div data-tahti-ui="embed" className="tahti-embed">
      {children}
    </div>
  )
}
