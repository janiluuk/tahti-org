// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import {
  fetchInternetRadioPresets,
  fetchMyInternetRadioStations,
} from '@/lib/internet-radio-client'
import { InternetRadioPanel } from '../../internet-radio-panel'

export default async function InternetRadioSettingsPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/settings/internet-radio')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/settings/internet-radio')

  const [presets, stations] = await Promise.all([
    fetchInternetRadioPresets(),
    fetchMyInternetRadioStations(),
  ])

  return (
    <div className="studio-settings-stack">
      <div className="studio-page-header">
        <h1 className="studio-page-title">Internet radio</h1>
      </div>

      <InternetRadioPanel initialPresets={presets.presets} initialStations={stations.stations} />
    </div>
  )
}
