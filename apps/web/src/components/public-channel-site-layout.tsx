// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { ChannelHeader, PublicFooter, type SiteNavId } from '@tahti/ui'
import { getSessionUser } from '@/lib/session'
import { statusPageUrl } from '@/lib/status-page'

type PublicChannelSiteLayoutProps = {
  children: ReactNode
  activeNav: SiteNavId
}

/** shell-public — Home, Discover, and similar brand routes. The gateway background
 * (<BgCanvas>) is NOT rendered here — it's a single persistent instance shared
 * across all public-nav routes (see PublicNavBg in the root layout) so navigating
 * between them doesn't reinitialize the WebGL scene. */
export async function PublicChannelSiteLayout({
  children,
  activeNav,
}: PublicChannelSiteLayoutProps) {
  const user = await getSessionUser()

  return (
    <div data-tahti-ui="brand" className="brand-channel shell-public">
      <ChannelHeader activeNav={activeNav} user={user} />
      <div className="shell-public__inner">{children}</div>
      <PublicFooter statusUrl={statusPageUrl()} />
    </div>
  )
}
