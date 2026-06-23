// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { ChannelHeader, PublicFooter, type SiteNavId } from '@tahti/ui'
import { BgCanvas } from '@/components/ui/bg-canvas'
import { getSessionUser } from '@/lib/session'
import { statusPageUrl } from '@/lib/status-page'

type PublicChannelSiteLayoutProps = {
  children: ReactNode
  activeNav: SiteNavId
  bgVariant?: 'default' | 'subtle'
}

/** shell-public with gateway background — Home, Discover, and similar brand routes. */
export async function PublicChannelSiteLayout({
  children,
  activeNav,
  bgVariant = 'default',
}: PublicChannelSiteLayoutProps) {
  const user = await getSessionUser()

  return (
    <div data-tahti-ui="brand" className="brand-channel shell-public">
      <BgCanvas variant={bgVariant} />
      <ChannelHeader activeNav={activeNav} user={user} />
      <div className="shell-public__inner">{children}</div>
      <PublicFooter statusUrl={statusPageUrl()} />
    </div>
  )
}
