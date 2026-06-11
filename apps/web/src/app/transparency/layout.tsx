// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { PublicBrandShell } from '@tahti/ui'
import '@tahti/ui/src/tokens.css'
import '@tahti/ui/src/components.css'
import '@tahti/ui/src/styles/brand-channel.css'
import '@tahti/ui/src/styles/brand-public.css'
import '@tahti/ui/src/styles/shells.css'
import { getSessionUser } from '@/lib/session'
import { statusPageUrl } from '@/lib/status-page'

export default async function TransparencyLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser()

  return (
    <PublicBrandShell wide showHeader showFooter user={user} statusUrl={statusPageUrl()}>
      {children}
    </PublicBrandShell>
  )
}
