// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { CommentSettingsPanel } from '../../comment-settings-panel'
import { MentionsPanel } from '../../mentions-panel'
import { NotificationPreferencesPanel } from '../notification-preferences-panel'
import { DashboardTabs } from '@/components/dashboard-tabs'
import { VisibilitySettingsPanel, type VisibilitySettings } from '../visibility-settings-panel'

export default async function NotificationSettingsPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/settings/notifications')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/settings/notifications')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const [visibility, commentState] = await Promise.all([
    loadVisibilitySettings(apiUrl, sessionValue),
    loadCommentSettings(apiUrl, sessionValue),
  ])

  return (
    <div className="studio-settings-stack">
      <div className="studio-page-header">
        <div>
          <h1 className="studio-page-title">Notifications &amp; visibility</h1>
          <p className="studio-text-muted-sm studio-mt-xs">
            Control profile visibility, comments, mentions, and how Tahti reaches you. MusicBrainz
            registration moved to{' '}
            <a href="/dashboard/settings/connections" className="studio-link">
              Connections
            </a>
            .
          </p>
        </div>
      </div>

      <DashboardTabs
        ariaLabel="Notification and visibility settings sections"
        tabs={[
          { id: 'alerts', label: 'Alerts', content: <NotificationPreferencesPanel /> },
          {
            id: 'visibility',
            label: 'Visibility',
            content: <VisibilitySettingsPanel initial={visibility} />,
          },
          {
            id: 'comments',
            label: 'Comments',
            content: (
              <CommentSettingsPanel
                initialChannelCommentsEnabled={commentState.channelCommentsEnabled}
                initialDefaultTrackCommentsEnabled={commentState.defaultTrackCommentsEnabled}
                initialDefaultChannelCommentsEnabled={commentState.defaultChannelCommentsEnabled}
              />
            ),
          },
          { id: 'mentions', label: 'Mentions', content: <MentionsPanel /> },
        ]}
      />
    </div>
  )
}

async function loadVisibilitySettings(
  apiUrl: string,
  sessionValue: string,
): Promise<VisibilitySettings> {
  const fallback: VisibilitySettings = {
    showJoinDate: true,
    showFollowers: true,
    showFollowing: true,
    showDailyListeners: true,
    chatEnabled: true,
  }
  try {
    const response = await fetch(`${apiUrl}/api/me/profile`, {
      headers: { Cookie: `tahti_session=${sessionValue}` },
      cache: 'no-store',
    })
    if (!response.ok) return fallback
    const profile = (await response.json()) as VisibilitySettings
    return {
      showJoinDate: profile.showJoinDate,
      showFollowers: profile.showFollowers,
      showFollowing: profile.showFollowing,
      showDailyListeners: profile.showDailyListeners,
      chatEnabled: profile.chatEnabled,
    }
  } catch {
    return fallback
  }
}

async function loadCommentSettings(apiUrl: string, sessionValue: string) {
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
    const channel = channelRes.ok
      ? ((await channelRes.json()) as { commentsEnabled: boolean })
      : null
    const defaults = defaultsRes.ok
      ? ((await defaultsRes.json()) as {
          defaultTrackCommentsEnabled: boolean
          defaultChannelCommentsEnabled: boolean
        })
      : null
    return {
      channelCommentsEnabled: channel?.commentsEnabled ?? true,
      defaultTrackCommentsEnabled: defaults?.defaultTrackCommentsEnabled ?? true,
      defaultChannelCommentsEnabled: defaults?.defaultChannelCommentsEnabled ?? true,
    }
  } catch {
    return {
      channelCommentsEnabled: true,
      defaultTrackCommentsEnabled: true,
      defaultChannelCommentsEnabled: true,
    }
  }
}
