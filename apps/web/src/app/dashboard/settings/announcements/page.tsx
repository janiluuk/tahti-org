// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { fetchMyAnnouncements } from './actions'
import { AnnouncementsPanel } from './_announcements-panel'

export default async function AnnouncementsSettingsPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/settings/announcements')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/settings/announcements')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const { clips } = await fetchMyAnnouncements()

  return (
    <div className="studio-settings-stack">
      <div className="studio-page-header">
        <h1 className="studio-page-title">Announcements</h1>
      </div>

      <AnnouncementsPanel initialClips={clips} />
    </div>
  )
}
