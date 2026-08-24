// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import '@tahti/ui/src/tokens.css'
import '@tahti/ui/src/components.css'
import '@tahti/ui/src/styles/brand-channel.css'
import '@tahti/ui/src/styles/shells.css'
import { PublicChannelSiteLayout } from '@/components/public-channel-site-layout'

/** Full-width, real header/nav, shared gateway background — same shell as
 * the homepage and Discover, not the narrower brand-public one Terms/Privacy/
 * AGPL/How-it-works use. No activeNav: About isn't one of the four top-nav
 * items, so the breadcrumb in the page itself carries the wayfinding job
 * instead of a misleading nav highlight. */
export default function AboutLayout({ children }: { children: ReactNode }) {
  return <PublicChannelSiteLayout>{children}</PublicChannelSiteLayout>
}
