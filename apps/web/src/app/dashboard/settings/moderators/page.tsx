// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import ModeratorsPanel from '../../moderators-panel'
import type { ModeratorRow } from '../../moderator-actions'

export default async function ModeratorsSettingsPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/settings/moderators')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/settings/moderators')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  let moderators: ModeratorRow[] = []
  try {
    const res = await fetch(`${apiUrl}/api/me/channel/moderators`, {
      headers: { Cookie: `tahti_session=${sessionValue}` },
      cache: 'no-store',
    })
    if (res.ok) moderators = (await res.json()) as ModeratorRow[]
  } catch {
    // render with partial data
  }

  return (
    <div className="studio-settings-stack">
      <div className="studio-page-header">
        <h1 className="studio-page-title">Moderators</h1>
      </div>

      <ModeratorsPanel initial={moderators} channelSlug={user.channel.slug} />
    </div>
  )
}
