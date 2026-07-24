// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { Heading, PageShell } from '@tahti/ui'
import { getDashboardUser } from '@/lib/dashboard-session'
import { StudioHeaderActions } from '../../../_studio-header-actions'
import { TrackInsightsView, type TrackInsightsPayload } from './_track-insights-view'

const KIND_TO_API_SEGMENT = {
  archive: 'archive',
  'release-track': 'release-tracks',
} as const

type InsightsKind = keyof typeof KIND_TO_API_SEGMENT

function isInsightsKind(value: string): value is InsightsKind {
  return value in KIND_TO_API_SEGMENT
}

export default async function TrackInsightsPage({
  params,
}: {
  params: { kind: string; id: string }
}) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  if (!sessionCookie) redirect('/login')
  if (!isInsightsKind(params.kind)) notFound()

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const cookie = `tahti_session=${sessionCookie.value}`
  const apiPath = `/api/me/${KIND_TO_API_SEGMENT[params.kind]}/${params.id}/insights`

  const [insightsRes, user] = await Promise.all([
    fetch(`${apiUrl}${apiPath}?period=30d`, { headers: { Cookie: cookie }, cache: 'no-store' }),
    getDashboardUser(),
  ])
  if (!insightsRes.ok) notFound()
  const insights = (await insightsRes.json()) as TrackInsightsPayload

  return (
    <PageShell size="md">
      <div className="studio-page-header">
        <div>
          <Heading level={1}>{insights.title}</Heading>
          <p className="studio-text-muted-sm">Insights</p>
        </div>
        <div className="studio-page-header__actions">
          <StudioHeaderActions
            hasChannel={Boolean(user?.channel)}
            isLive={user?.channel?.state === 'LIVE'}
            channelSlug={user?.channel?.slug}
            showBack
            backHref={params.kind === 'archive' ? '/dashboard/archive' : '/dashboard/releases'}
            backLabel={params.kind === 'archive' ? 'Music' : 'Releases'}
          />
        </div>
      </div>

      <TrackInsightsView apiPath={apiPath} initial={insights} />
    </PageShell>
  )
}
