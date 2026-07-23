// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { MembersPanel } from './_members-panel'
import { fetchMyMembers } from './actions'

export default async function MembersSettingsPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/settings/members')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/settings/members')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const members = await fetchMyMembers()

  return (
    <div className="studio-settings-stack">
      <div className="studio-page-header">
        <h1 className="studio-page-title">Members</h1>
      </div>

      <MembersPanel initialMembers={members} />
    </div>
  )
}
