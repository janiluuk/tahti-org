// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { listMyIntegrations } from '../../integrations-actions'
import { IntegrationsPanel } from '../../integrations-panel'

export default async function IntegrationsSettingsPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/settings/integrations')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/settings/integrations')

  const { integrations } = await listMyIntegrations()

  return (
    <div className="studio-settings-stack">
      <div className="studio-page-header">
        <h1 className="studio-page-title">Integrations</h1>
      </div>

      <IntegrationsPanel initial={integrations} />
    </div>
  )
}
