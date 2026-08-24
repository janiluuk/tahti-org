// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { fetchDiscoWidgetInstalls, fetchDiscoWidgetStore } from '@/lib/disco-widgets-client'
import { DiscoverySettingsPanel } from '../../discovery-settings-panel'
import { DiscoWidgetsPanel } from '../../disco-widgets-panel'

export default async function DiscoverySettingsPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/settings/discovery')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/settings/discovery')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  let topListsOptOut = false

  try {
    const res = await fetch(`${apiUrl}/api/me/top-lists-opt-out`, {
      headers: { Cookie: `tahti_session=${sessionValue}` },
      cache: 'no-store',
    })
    if (res.ok) {
      const data = (await res.json()) as { topListsOptOut: boolean }
      topListsOptOut = data.topListsOptOut
    }
  } catch {
    // render with defaults
  }

  const [store, installs] = await Promise.all([
    fetchDiscoWidgetStore('LISTENER'),
    fetchDiscoWidgetInstalls('/api/me/disco-widgets/installs'),
  ])

  return (
    <div className="studio-settings-stack">
      <div className="studio-page-header">
        <h1 className="studio-page-title">Discovery</h1>
      </div>

      <DiscoverySettingsPanel initialTopListsOptOut={topListsOptOut} />

      <div className="studio-page-header studio-mt-lg">
        <h2 className="studio-page-title">Disco-widgets</h2>
      </div>
      <DiscoWidgetsPanel initialWidgets={store.widgets} initialInstalls={installs.installs} />
    </div>
  )
}
