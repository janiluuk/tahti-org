// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { PageShell, Text } from '@tahti/ui'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { StudioHeaderActions } from '../../_studio-header-actions'
import { fetchChannelProgramme } from '../../programme-actions'
import { RotationEditor } from '../../schedule/_rotation-editor'

export default async function ChannelPlaylistPage() {
  if (!dashboardSessionCookie()) redirect('/login?next=/dashboard/channel/playlist')

  const [user, { data }] = await Promise.all([getDashboardUser(), fetchChannelProgramme()])
  if (!user) redirect('/login?next=/dashboard/channel/playlist')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const initial = data ?? {
    fallbackMode: 'shuffle' as const,
    fallbackEnabled: true,
    fallbackAutoEnroll: true,
    announcementsEnabled: true,
    items: [],
    library: [],
  }

  return (
    <PageShell size="lg" className="studio-channel-editor-page">
      <header className="studio-page-header studio-channel-editor-page__header">
        <div>
          <h1 className="studio-page-title">24/7 channel playlist</h1>
          <Text tone="muted" size="sm">
            Add tracks and sets, preview them, and drag the queue into its playback order.
          </Text>
        </div>
        <StudioHeaderActions
          hasChannel
          isLive={user.channel.state === 'LIVE'}
          channelSlug={user.channel.slug}
          showBack
          backHref="/dashboard"
          backLabel="Channel"
        />
      </header>

      <RotationEditor initial={initial} channelSlug={user.channel.slug} />
    </PageShell>
  )
}
