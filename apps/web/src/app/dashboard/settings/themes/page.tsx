// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { fetchMyThemes } from '@/lib/themes-client'
import { ThemesPanel } from '../../themes-panel'

export default async function ThemesSettingsPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/settings/themes')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/settings/themes')

  const { themes } = await fetchMyThemes()

  return (
    <div className="studio-settings-stack">
      <div className="studio-page-header">
        <h1 className="studio-page-title">Themes</h1>
      </div>

      <ThemesPanel initialThemes={themes} />
    </div>
  )
}
