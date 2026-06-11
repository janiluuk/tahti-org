// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { ChannelHeader, PublicFooter } from '@tahti/ui'
import '@tahti/ui/src/tokens.css'
import '@tahti/ui/src/styles/brand-channel.css'
import { getSessionUser } from '@/lib/session'

/** Venues directory — same dark shell + top nav as Home, Discover, Radio. */
export default async function VenuesLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser()

  return (
    <div data-tahti-ui="brand" className="brand-channel">
      <ChannelHeader activeNav="venues" user={user} />
      {children}
      <PublicFooter />
    </div>
  )
}
