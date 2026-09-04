// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReactNode } from 'react'
import Link from 'next/link'
import { PublicBrandShell } from '@tahti/ui'
import '@/lib/import-public-brand-css'
import { getSessionUser } from '@/lib/session'
import { statusPageUrl } from '@/lib/status-page'

export default async function GovernanceLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser()

  return (
    <PublicBrandShell wide showHeader showFooter user={user} statusUrl={statusPageUrl()}>
      <nav className="brand-governance-nav" aria-label="Governance navigation">
        <Link href="/dashboard/governance">Governance overview</Link>
        <Link href="/dashboard/governance/motions">Member motions</Link>
        <Link href="/dashboard/governance/transparency#member-motion-history">
          Published results
        </Link>
      </nav>
      {children}
    </PublicBrandShell>
  )
}
