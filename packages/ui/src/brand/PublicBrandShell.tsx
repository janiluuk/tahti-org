// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { ChannelHeader } from './ChannelPageLayout'
import { PublicFooter } from './PublicFooter'

export type PublicBrandShellProps = {
  children: ReactNode
  /** Narrow centered layout for auth, verify, smart links */
  center?: boolean
  /** Wider layout for channel and collection pages */
  wide?: boolean
  /** Render the shared site nav (Home/Discover/Radio/Venues) above the page content. */
  showHeader?: boolean
  /** Render the shared footer (governance/legal/source links) below the page content. */
  showFooter?: boolean
  /** Signed-in user, forwarded to ChannelHeader when showHeader is set. */
  user?: { username: string; displayName: string } | null
  /** Status page URL, forwarded to PublicFooter when showFooter is set. */
  statusUrl?: string
}

/** Light public pages using brand-public.css — import that stylesheet on the route. */
export function PublicBrandShell({
  children,
  center,
  wide,
  showHeader,
  showFooter,
  user,
  statusUrl,
}: PublicBrandShellProps) {
  const layoutClass = [
    'brand-public',
    center && 'brand-public--center',
    wide && 'brand-public--wide',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div data-tahti-ui="brand">
      {showHeader && <ChannelHeader user={user} />}
      <div className={layoutClass}>{children}</div>
      {showFooter && <PublicFooter statusUrl={statusUrl} />}
    </div>
  )
}
