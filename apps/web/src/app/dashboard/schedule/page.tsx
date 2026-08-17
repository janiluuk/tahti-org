// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { redirect } from 'next/navigation'
import { PageShell, Text } from '@tahti/ui'
import type { LiveShowSeriesView, ScheduledLiveShowView } from '@tahti/shared'
import { dashboardSessionCookie, getDashboardUser } from '@/lib/dashboard-session'
import { StudioHeaderActions } from '../_studio-header-actions'
import ChannelSchedulePanel from '../channel-schedule-panel'

export default async function SchedulePage() {
  const sessionValue = dashboardSessionCookie()
  if (!sessionValue) redirect('/login?next=/dashboard/schedule')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'

  type ChannelScheduleResponse = {
    nextBroadcastAt: string | null
    nextBroadcastNote: string | null
  }
  const emptyChannelSchedule: ChannelScheduleResponse = {
    nextBroadcastAt: null,
    nextBroadcastNote: null,
  }

  const emptySeries: { series: LiveShowSeriesView[]; scheduledShows: ScheduledLiveShowView[] } = {
    series: [],
    scheduledShows: [],
  }

  const [user, channelSchedule, showSeries] = await Promise.all([
    getDashboardUser(),
    fetch(`${apiUrl}/api/me/channel/schedule`, {
      headers: { Cookie: `tahti_session=${sessionValue}` },
      cache: 'no-store',
    })
      .then((res) =>
        res.ok ? (res.json() as Promise<ChannelScheduleResponse>) : emptyChannelSchedule,
      )
      .catch(() => emptyChannelSchedule),
    fetch(`${apiUrl}/api/me/channel/show-series`, {
      headers: { Cookie: `tahti_session=${sessionValue}` },
      cache: 'no-store',
    })
      .then((res) =>
        res.ok
          ? (res.json() as Promise<typeof emptySeries>)
          : emptySeries,
      )
      .catch(() => emptySeries),
  ])

  if (!user) redirect('/login?next=/dashboard/schedule')
  if (!user.channel) redirect('/dashboard/setup-channel')

  const isLive = user.channel.state === 'LIVE'

  return (
    <PageShell size="lg" className="studio-channel-editor-page">
      <header className="studio-page-header studio-channel-editor-page__header">
        <div>
          <h1 className="studio-page-title">Schedule</h1>
          <Text tone="muted" size="sm">
            Plan upcoming broadcasts and recurring live show series.
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

      <ChannelSchedulePanel
        initialAt={channelSchedule.nextBroadcastAt}
        initialNote={channelSchedule.nextBroadcastNote}
        initialSeries={showSeries.series}
        initialScheduledShows={showSeries.scheduledShows}
        isLive={isLive}
      />
    </PageShell>
  )
}
