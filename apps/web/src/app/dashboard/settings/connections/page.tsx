// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { fetchChannelEditorData } from '../../channel/_channel-editor-data'
import { SocialConnectionsSection } from '../artist-info/_social-connections'
import { ConnectionsForm } from './_connections-form'

export default async function ConnectionsSettingsPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/settings/connections')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/settings/connections')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const { links, streamingLinks, genres } = await fetchChannelEditorData(
    apiUrl,
    sessionValue,
    user.channel.slug,
  )

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

      <ConnectionsForm initial={{ links, streamingLinks }} genresCsv={genres.join(', ')}>
        <SocialConnectionsSection apiUrl={apiUrl} sessionValue={sessionValue} />
      </ConnectionsForm>
    </div>
  )
}
