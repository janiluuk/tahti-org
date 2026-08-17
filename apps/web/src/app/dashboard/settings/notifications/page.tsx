// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { CommentSettingsPanel } from '../../comment-settings-panel'
import { MusicbrainzSettingsPanel } from '../../musicbrainz-settings-panel'
import { MentionsPanel } from '../../mentions-panel'
import { NotificationPreferencesPanel } from '../notification-preferences-panel'
import { fetchMyAnnouncements } from '../announcements/actions'
import { AnnouncementsPanel } from '../announcements/_announcements-panel'

export default async function NotificationSettingsPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/settings/notifications')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/settings/notifications')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const [{ clips }, commentState, musicbrainzState] = await Promise.all([
    fetchMyAnnouncements(),
    loadCommentSettings(apiUrl, sessionValue),
    loadMusicbrainzSettings(apiUrl, sessionValue),
  ])

  return (
    <div className="studio-settings-stack">
      <div className="studio-page-header">
        <div>
          <h1 className="studio-page-title">Notification settings</h1>
          <p className="studio-text-muted-sm studio-mt-xs">
            Comments, mentions, announcement clips, and how Tahti reaches you.
          </p>
        </div>
      </div>

      <div id="email">
        <NotificationPreferencesPanel />
      </div>

      <div id="comments">
        <CommentSettingsPanel
          initialChannelCommentsEnabled={commentState.channelCommentsEnabled}
          initialDefaultTrackCommentsEnabled={commentState.defaultTrackCommentsEnabled}
          initialDefaultChannelCommentsEnabled={commentState.defaultChannelCommentsEnabled}
        />
      </div>

      <div id="musicbrainz">
        <MusicbrainzSettingsPanel
          initialConnected={musicbrainzState.connected}
          initialUsername={musicbrainzState.username}
          initialConfigured={musicbrainzState.configured}
          initialDefault={musicbrainzState.defaultRegisterToMusicbrainz}
        />
      </div>

      <div id="mentions">
        <MentionsPanel />
      </div>

      <div id="announcements">
        <AnnouncementsPanel initialClips={clips} />
      </div>
    </div>
  )
}

async function loadMusicbrainzSettings(apiUrl: string, sessionValue: string) {
  try {
    const [statusRes, defaultRes] = await Promise.all([
      fetch(`${apiUrl}/api/me/musicbrainz`, {
        headers: { Cookie: `tahti_session=${sessionValue}` },
        cache: 'no-store',
      }),
      fetch(`${apiUrl}/api/me/musicbrainz/default`, {
        headers: { Cookie: `tahti_session=${sessionValue}` },
        cache: 'no-store',
      }),
    ])
    const status = statusRes.ok
      ? ((await statusRes.json()) as {
          connected: boolean
          username: string | null
          configured: boolean
        })
      : { connected: false, username: null, configured: false }
    const defaults = defaultRes.ok
      ? ((await defaultRes.json()) as { defaultRegisterToMusicbrainz: boolean | null })
      : { defaultRegisterToMusicbrainz: null }
    return { ...status, defaultRegisterToMusicbrainz: defaults.defaultRegisterToMusicbrainz }
  } catch {
    return { connected: false, username: null, configured: false, defaultRegisterToMusicbrainz: null }
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
