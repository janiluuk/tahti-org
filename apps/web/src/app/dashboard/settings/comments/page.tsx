// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { CommentSettingsPanel } from '../../comment-settings-panel'

export default async function CommentsSettingsPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/settings/comments')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/settings/comments')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  let channelCommentsEnabled = true
  let defaultTrackCommentsEnabled = true
  let defaultChannelCommentsEnabled = true

  try {
    const [channelRes, defaultsRes] = await Promise.all([
      fetch(`${apiUrl}/api/me/comments/channel`, {
        headers: { Cookie: `tahti_session=${sessionValue}` },
        cache: 'no-store',
      }),
      fetch(`${apiUrl}/api/me/comments/defaults`, {
        headers: { Cookie: `tahti_session=${sessionValue}` },
        cache: 'no-store',
      }),
    ])
    if (channelRes.ok) {
      const data = (await channelRes.json()) as { commentsEnabled: boolean }
      channelCommentsEnabled = data.commentsEnabled
    }
    if (defaultsRes.ok) {
      const data = (await defaultsRes.json()) as {
        defaultTrackCommentsEnabled: boolean
        defaultChannelCommentsEnabled: boolean
      }
      defaultTrackCommentsEnabled = data.defaultTrackCommentsEnabled
      defaultChannelCommentsEnabled = data.defaultChannelCommentsEnabled
    }
  } catch {
    // render with defaults
  }

  return (
    <div className="studio-settings-stack">
      <div className="studio-page-header">
        <h1 className="studio-page-title">Comments</h1>
      </div>

      <CommentSettingsPanel
        initialChannelCommentsEnabled={channelCommentsEnabled}
        initialDefaultTrackCommentsEnabled={defaultTrackCommentsEnabled}
        initialDefaultChannelCommentsEnabled={defaultChannelCommentsEnabled}
      />
    </div>
  )
}
