// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { fetchChannelEditorData } from '../../channel/_channel-editor-data'
import { ArtistInfoForm } from './_artist-info-form'

export default async function ArtistInfoSettingsPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/settings/artist-info')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/settings/artist-info')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const { avatarUrl, bio, countryCode, pronouns, genres, links } = await fetchChannelEditorData(
    apiUrl,
    sessionValue,
    user.channel.slug,
  )

  return (
    <div>
      <div className="studio-page-header">
        <div>
          <h1 className="studio-page-title">Artist info</h1>
          <p className="studio-text-muted-sm studio-mt-xs">
            Your name, bio, and links — shown on your channel page. For colors, backgrounds, and
            layout, use{' '}
            <a href="/dashboard/channel/edit" className="studio-link">
              Channel design
            </a>
            .
          </p>
        </div>
      </div>

      <ArtistInfoForm
        initial={{
          displayName: user.displayName,
          avatarUrl,
          countryCode,
          pronouns,
          genres,
          bio,
          links,
        }}
      />
    </div>
  )
}
