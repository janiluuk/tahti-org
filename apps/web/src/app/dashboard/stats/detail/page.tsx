// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Heading, PageShell } from '@tahti/ui'
import { getDashboardUser } from '@/lib/dashboard-session'
import { StudioHeaderActions } from '../../_studio-header-actions'
import { StatsPlaysPanel } from '../stats-plays-panel'
import { ListenerMapPanel } from '../listener-map-panel'

interface PlaysPayload {
  range: '7' | '30' | 'all'
  totalPlays: number
  totalDownloads: number
  daily: Array<{ date: string; plays: number }>
}

interface ListenerGeoPoint {
  countryCode: string
  displayName: string
  count: number
}

interface ListenerGeoPayload {
  period: '7d' | '30d' | 'all'
  geo: ListenerGeoPoint[]
}

async function apiFetch<T>(apiUrl: string, cookie: string, path: string): Promise<T | null> {
  try {
    const res = await fetch(`${apiUrl}${path}`, {
      headers: { Cookie: cookie },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export default async function StatsDetailPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const cookie = `tahti_session=${sessionCookie.value}`

  const [plays, listenerGeo, user] = await Promise.all([
    apiFetch<PlaysPayload>(apiUrl, cookie, '/api/me/stats/plays?range=30'),
    apiFetch<ListenerGeoPayload>(apiUrl, cookie, '/api/me/listener-geo?period=30d'),
    getDashboardUser(),
  ])

  return (
    <PageShell size="md">
      <div className="studio-page-header">
        <div>
          <Heading level={1}>Plays &amp; listeners</Heading>
        </div>
        <div className="studio-page-header__actions">
          <StudioHeaderActions
            hasChannel={Boolean(user?.channel)}
            isLive={user?.channel?.state === 'LIVE'}
            channelSlug={user?.channel?.slug}
            showBack
            backHref="/dashboard/stats"
            backLabel="Stats"
          />
        </div>
      </div>

      {plays && <StatsPlaysPanel initial={plays} />}

      <ListenerMapPanel
        initial={listenerGeo?.geo ?? []}
        initialPeriod={listenerGeo?.period ?? '30d'}
      />
    </PageShell>
  )
}
