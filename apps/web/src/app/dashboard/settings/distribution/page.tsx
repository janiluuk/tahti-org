// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { TahtiRadioPanel } from '../../tahti-radio-panel'
import AnnouncementsPanel from '../../announcements-panel'

export default async function DistributionSettingsPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/settings/distribution')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/settings/distribution')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  let announcements: Array<{ id: string; body: string; createdAt: string }> = []
  try {
    const res = await fetch(`${apiUrl}/api/chat/${user.channel.slug}/announcements`, {
      headers: { Cookie: `tahti_session=${sessionValue}` },
      cache: 'no-store',
    })
    if (res.ok) announcements = (await res.json()) as typeof announcements
  } catch {
    // render with partial data
  }

  return (
    <div className="studio-settings-stack">
      <div className="studio-page-header">
        <h1 className="studio-page-title">Radio &amp; announcements</h1>
        <p className="studio-text-muted-sm studio-mt-xs">
          How your broadcast and archive reach listeners beyond your own channel page.
        </p>
      </div>

      <TahtiRadioPanel />
      <AnnouncementsPanel initial={announcements} />
    </div>
  )
}
