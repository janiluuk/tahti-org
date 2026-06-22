// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { getDashboardUser } from '@/lib/dashboard-session'
import { CustomDomainPanel } from '../../custom-domain-panel'

export default async function DomainSettingsPage() {
  const user = await getDashboardUser()
  if (!user) redirect('/login')

  return (
    <div className="studio-settings-stack">
      <div className="studio-page-header">
        <div>
          <h1 className="studio-page-title">Domain</h1>
          <p className="studio-text-muted-sm studio-mt-xs">
            Point a custom domain at your channel instead of username.tahti.live.
          </p>
        </div>
      </div>

      <CustomDomainPanel
        initialDomain={user.channel?.customDomain ?? null}
        initialVerified={user.channel?.customDomainVerified ?? false}
        isPaid={user.tier !== 'FREE'}
      />
    </div>
  )
}
