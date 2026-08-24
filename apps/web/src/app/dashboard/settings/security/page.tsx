// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { TwoFactorPanel } from '../../two-factor-panel'

export default async function SecuritySettingsPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  if (!sessionCookie) redirect('/login')

  return (
    <div className="studio-settings-stack">
      <div className="studio-page-header">
        <div>
          <h1 className="studio-page-title">Security</h1>
          <p className="studio-text-muted-sm studio-mt-xs">
            Manage how you sign in and protect your account.
          </p>
        </div>
      </div>

      <TwoFactorPanel />
    </div>
  )
}
