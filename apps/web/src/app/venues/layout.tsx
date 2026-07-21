// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import { PublicBrandShell } from '@tahti/ui'
import '@/lib/import-public-brand-css'
import { getSessionUser } from '@/lib/session'
import { statusPageUrl } from '@/lib/status-page'

/** Venues directory — shell-public via PublicBrandShell. The gateway background
 * (<BgCanvas>) is NOT rendered here — it's a single persistent instance shared
 * across all public-nav routes (see PublicNavBg in the root layout) so navigating
 * between them doesn't reinitialize the WebGL scene. */
export default async function VenuesLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser()

  return (
    <PublicBrandShell
      wide
      showHeader
      showFooter
      activeNav="venues"
      user={user}
      statusUrl={statusPageUrl()}
    >
      {children}
    </PublicBrandShell>
  )
}
