// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { PageShell, Text } from '@tahti/ui'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { StudioHeaderActions } from '../../_studio-header-actions'
import { fetchChannelEditorData } from '../_channel-editor-data'
import { ChannelGallerySections } from './_channel-gallery-sections'

export default async function ChannelGalleryPage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/channel/gallery')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/channel/gallery')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const data = await fetchChannelEditorData(apiUrl, sessionValue, user.channel.slug)

  const isLive = user.channel.state === 'LIVE'

  return (
    <PageShell size="lg" className="studio-channel-editor-page">
      <header className="studio-page-header studio-channel-editor-page__header">
        <div>
          <h1 className="studio-page-title">Gallery &amp; backdrop</h1>
          <Text tone="muted" size="sm">
            Photos, video backdrop, and slideshow transitions behind your channel player.
          </Text>
        </div>
        <div className="studio-page-header__actions">
          <StudioHeaderActions
            hasChannel
            isLive={isLive}
            channelSlug={user.channel.slug}
            showBack
            backHref="/dashboard/channel"
            backLabel="Channel design"
          />
        </div>
      </header>

      <ChannelGallerySections
        channelSlug={user.channel.slug}
        displayName={user.displayName}
        {...data}
      />
    </PageShell>
  )
}
