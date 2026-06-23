// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { PageShell, Text } from '@tahti/ui'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { StudioHeaderActions } from '../_studio-header-actions'
import { fetchChannelProgramme } from '../programme-actions'
import { RotationEditor } from './_rotation-editor'

export default async function SchedulePage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/schedule')

  const user = await getDashboardUser()
  if (!user) redirect('/login?next=/dashboard/schedule')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const { data } = await fetchChannelProgramme()
  const initial = data ?? {
    fallbackMode: 'shuffle' as const,
    fallbackEnabled: true,
    items: [],
    library: [],
  }
  const isLive = user.channel.state === 'LIVE'

  return (
    <PageShell size="lg" className="studio-channel-editor-page">
      <header className="studio-page-header studio-channel-editor-page__header">
        <div>
          <h1 className="studio-page-title">Schedule</h1>
          <Text tone="muted" size="sm">
            Build the 24/7 rotation that plays on your channel whenever you are offline — mix in
            sets from your archive and tracks from your release library.
          </Text>
        </div>
        <div className="studio-page-header__actions">
          <StudioHeaderActions
            hasChannel
            isLive={isLive}
            channelSlug={user.channel.slug}
            showBack
            backHref="/dashboard"
            backLabel="Dashboard"
          />
        </div>
      </header>

      <RotationEditor initial={initial} channelSlug={user.channel.slug} />
    </PageShell>
  )
}
