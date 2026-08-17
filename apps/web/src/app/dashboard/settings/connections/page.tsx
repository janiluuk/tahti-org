// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { fetchChannelEditorData } from '../../channel/_channel-editor-data'
import { SocialConnectionsSection } from '../artist-info/_social-connections'
import { MusicbrainzSettingsPanel } from '../../musicbrainz-settings-panel'
import { ConnectionsForm } from './_connections-form'

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
    return {
      connected: false,
      username: null,
      configured: false,
      defaultRegisterToMusicbrainz: null,
    }
  }
}

export default async function ConnectionsSettingsPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/settings/connections')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/settings/connections')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const [{ links, streamingLinks, genres }, musicbrainzState] = await Promise.all([
    fetchChannelEditorData(apiUrl, sessionValue, user.channel.slug),
    loadMusicbrainzSettings(apiUrl, sessionValue),
  ])

  return (
    <div>
      <div className="studio-page-header">
        <div>
          <h1 className="studio-page-title">Connections</h1>
          <p className="studio-text-muted-sm studio-mt-xs">
            Streaming platforms, profile links, and connected accounts for import and social promo.
            Name, bio, and members live under{' '}
            <a href="/dashboard/settings/artist-info" className="studio-link">
              Artist info
            </a>
            .
          </p>
        </div>
      </div>

      <ConnectionsForm
        initial={{ links, streamingLinks }}
        genresCsv={genres.join(', ')}
        musicbrainz={
          <MusicbrainzSettingsPanel
            initialConnected={musicbrainzState.connected}
            initialUsername={musicbrainzState.username}
            initialConfigured={musicbrainzState.configured}
            initialDefault={musicbrainzState.defaultRegisterToMusicbrainz}
          />
        }
      >
        <SocialConnectionsSection apiUrl={apiUrl} sessionValue={sessionValue} />
      </ConnectionsForm>
    </div>
  )
}
