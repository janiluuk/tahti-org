// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import type { GreenRoomDefaults } from '@tahti/shared'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { GreenRoomDefaultsPanel } from './_green-room-defaults-panel'

export default async function GreenRoomSettingsPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/settings/green-room')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/settings/green-room')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  let defaults: GreenRoomDefaults = {
    defaultEnabled: false,
    defaultInvitePool: 'MODERATORS_AND_SUBS',
  }

  try {
    const res = await fetch(`${apiUrl}/api/me/channel/green-room-defaults`, {
      headers: { Cookie: `tahti_session=${sessionValue}` },
      cache: 'no-store',
    })
    if (res.ok) defaults = (await res.json()) as GreenRoomDefaults
  } catch {
    // render with defaults
  }

  return (
    <div className="studio-settings-stack">
      <div className="studio-page-header">
        <h1 className="studio-page-title">Green room</h1>
        <p className="studio-text-muted-sm studio-mt-xs">
          Default backstage settings for pre-live broadcasts — invite collaborators to hear your
          preview before listeners can tune in.
        </p>
      </div>

      <GreenRoomDefaultsPanel initial={defaults} />
    </div>
  )
}
