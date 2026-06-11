// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import '@tahti/ui/src/tokens.css'
import '@tahti/ui/src/components.css'
import '@tahti/ui/src/styles/brand-channel.css'
import '@tahti/ui/src/styles/shells.css'
import { PublicChannelSiteLayout } from '@/components/public-channel-site-layout'

/** Discover — shell-public with gateway background. */
export default function ListenLayout({ children }: { children: ReactNode }) {
  return <PublicChannelSiteLayout activeNav="discover">{children}</PublicChannelSiteLayout>
}
