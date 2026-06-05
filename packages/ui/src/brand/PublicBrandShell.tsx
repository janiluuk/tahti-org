// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'

type PublicBrandShellProps = {
  children: ReactNode
  /** Narrow centered layout for auth, verify, smart links */
  center?: boolean
  /** Wider layout for channel and collection pages */
  wide?: boolean
}

/** Light public pages using brand-public.css — import that stylesheet on the route. */
export function PublicBrandShell({ children, center, wide }: PublicBrandShellProps) {
  const layoutClass = [
    'brand-public',
    center && 'brand-public--center',
    wide && 'brand-public--wide',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div data-tahti-ui="brand">
      <div className={layoutClass}>{children}</div>
    </div>
  )
}
