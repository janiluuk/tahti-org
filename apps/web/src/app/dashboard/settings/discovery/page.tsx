// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { fetchAddonInstalls, fetchAddonStore } from '@/lib/addons-client'
import { DiscoverySettingsPanel } from '../../discovery-settings-panel'
import { AddonsPanel } from '../../addons-panel'
import { NewsFeedPanel } from '../../news-feed-panel'

export default async function DiscoverySettingsPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/settings/discovery')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/settings/discovery')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  let topListsOptOut = false
  let newsFeedUrl: string | null = null

  try {
    const [optOutRes, profileRes] = await Promise.all([
      fetch(`${apiUrl}/api/me/top-lists-opt-out`, {
        headers: { Cookie: `tahti_session=${sessionValue}` },
        cache: 'no-store',
      }),
      fetch(`${apiUrl}/api/me/profile`, {
        headers: { Cookie: `tahti_session=${sessionValue}` },
        cache: 'no-store',
      }),
    ])
    if (optOutRes.ok) {
      const data = (await optOutRes.json()) as { topListsOptOut: boolean }
      topListsOptOut = data.topListsOptOut
    }
    if (profileRes.ok) {
      const data = (await profileRes.json()) as { newsFeedUrl: string | null }
      newsFeedUrl = data.newsFeedUrl
    }
  } catch {
    // render with defaults
  }

  const [store, installs] = await Promise.all([
    fetchAddonStore('LISTENER'),
    fetchAddonInstalls('/api/me/addons/installs'),
  ])

  return (
    <div className="studio-settings-stack">
      <div className="studio-page-header">
        <h1 className="studio-page-title">Discovery</h1>
      </div>

      <DiscoverySettingsPanel initialTopListsOptOut={topListsOptOut} />

      <NewsFeedPanel initialUrl={newsFeedUrl} />

      <div className="studio-page-header studio-mt-lg">
        <h2 className="studio-page-title">Addons</h2>
      </div>
      <AddonsPanel initialWidgets={store.widgets} initialInstalls={installs.installs} />
    </div>
  )
}
