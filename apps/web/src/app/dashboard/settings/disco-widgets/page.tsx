// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { fetchDiscoWidgetInstalls, fetchDiscoWidgetStore } from '@/lib/disco-widgets-client'
import { DiscoWidgetsPanel } from '../../disco-widgets-panel'

export default async function DiscoWidgetsSettingsPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/settings/disco-widgets')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/settings/disco-widgets')

  const [store, installs] = await Promise.all([
    fetchDiscoWidgetStore('LISTENER'),
    fetchDiscoWidgetInstalls('/api/me/disco-widgets/installs'),
  ])

  return (
    <div className="studio-settings-stack">
      <div className="studio-page-header">
        <h1 className="studio-page-title">Disco-widgets</h1>
      </div>

      <DiscoWidgetsPanel initialWidgets={store.widgets} initialInstalls={installs.installs} />
    </div>
  )
}
