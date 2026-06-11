// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { PublicBrandShell } from '@tahti/ui'
import '@tahti/ui/src/tokens.css'
import '@tahti/ui/src/components.css'
import '@tahti/ui/src/styles/brand-channel.css'
import '@tahti/ui/src/styles/brand-public.css'
import { getSessionUser } from '@/lib/session'

export default async function VenueProfileLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser()

  return (
    <PublicBrandShell wide showHeader showFooter user={user}>
      {children}
    </PublicBrandShell>
  )
}
