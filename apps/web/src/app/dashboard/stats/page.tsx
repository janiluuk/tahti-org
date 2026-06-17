// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Heading, PageShell, StatCard, StatCardGrid } from '@tahti/ui'
import { StatsPlaysPanel } from './stats-plays-panel'
import { ListenerMapPanel } from './listener-map-panel'

interface FanPayoutStats {
  paidLast30Days: number
  activeSubscribers: number
}

interface TopTrack {
  archiveItemId: string
  title: string
  plays: number
}

interface TopCountry {
  country: string
  count: number
}

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

export default async function StatsPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const cookie = `tahti_session=${sessionCookie.value}`

  const [plays, topTracks, topCountries, fanPayouts, listenerGeo] = await Promise.all([
    apiFetch<PlaysPayload>(apiUrl, cookie, '/api/me/stats/plays?range=30'),
    apiFetch<{ items: TopTrack[] }>(apiUrl, cookie, '/api/me/stats/top-tracks'),
    apiFetch<{ items: TopCountry[] }>(apiUrl, cookie, '/api/me/stats/top-countries'),
    apiFetch<FanPayoutStats>(apiUrl, cookie, '/api/me/fan-sub-payouts'),
    apiFetch<ListenerGeoPayload>(apiUrl, cookie, '/api/me/listener-geo?period=30d'),
  ])

  const downloads = plays?.totalDownloads ?? 0
  const totalPlays = plays?.totalPlays ?? 0
  const fanSubs = fanPayouts?.activeSubscribers ?? 0
  const revenueCents = fanPayouts?.paidLast30Days ?? 0

  const tracks = topTracks?.items ?? []
  const countries = topCountries?.items ?? []
  const maxCountry = Math.max(1, ...countries.map((c) => c.count))

  const engagementUnits = [
    { label: `${downloads} downloads × 1`, value: downloads, color: 'green' as const },
    { label: `${totalPlays} plays × 1`, value: totalPlays, color: 'amber' as const },
    { label: `${fanSubs} fan-subs × 1`, value: fanSubs, color: 'purple' as const },
  ]
  const maxEng = Math.max(1, ...engagementUnits.map((e) => e.value))

  const hasData = totalPlays > 0 || tracks.length > 0 || countries.length > 0

  return (
    <PageShell size="md">
      <div className="studio-page-header">
        <Heading level={1}>Stats</Heading>
      </div>

      <StatCardGrid>
        <StatCard variant="plays" value={totalPlays.toLocaleString()} label="Plays this month" />
        <StatCard variant="downloads" value={downloads.toLocaleString()} label="Downloads" />
        <StatCard variant="fans" value={fanSubs.toLocaleString()} label="Fan subscribers" />
        <StatCard
          variant="revenue"
          value={`€${(revenueCents / 100).toFixed(0)}`}
          label="Fan-sub / mo"
        />
      </StatCardGrid>

      {plays && <StatsPlaysPanel initial={plays} />}

      <ListenerMapPanel
        initial={listenerGeo?.geo ?? []}
        initialPeriod={listenerGeo?.period ?? '30d'}
      />

      {(tracks.length > 0 || countries.length > 0) && (
        <div className="stats-two-col">
          {tracks.length > 0 && (
            <div className="stats-panel">
              <div className="stats-panel-header">
                <span className="stats-section-label">TOP TRACKS</span>
              </div>
              <ol className="stats-top-list">
                {tracks.map((t, i) => (
                  <li key={t.archiveItemId} className="stats-top-row">
                    <span className="stats-top-rank">{i + 1}</span>
                    <span className="stats-top-name">{t.title}</span>
                    <span className="stats-top-value stats-top-value--amber">{t.plays}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {countries.length > 0 && (
            <div className="stats-panel">
              <div className="stats-panel-header">
                <span className="stats-section-label">TOP COUNTRIES</span>
                <span className="stats-panel-total">from smart-link referers</span>
              </div>
              <ol className="stats-top-list">
                {countries.map((c) => (
                  <li key={c.country} className="stats-top-row stats-top-row--country">
                    <span className="stats-top-name">{c.country}</span>
                    <span className="stats-eng-bar-wrap stats-eng-bar-wrap--inline">
                      <span
                        className="stats-eng-bar stats-eng-bar--cyan"
                        style={{
                          ['--w' as string]: `${Math.round((c.count / maxCountry) * 100)}%`,
                        }}
                      />
                    </span>
                    <span className="stats-top-value stats-top-value--cyan">{c.count}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      <div className="stats-panel">
        <div className="stats-panel-header">
          <span className="stats-section-label">ENGAGEMENT UNITS</span>
        </div>
        <div className="stats-engagement-rows">
          {engagementUnits.map((row) => (
            <div key={row.label} className="stats-eng-row">
              <span className="stats-eng-label">{row.label}</span>
              <span className="stats-eng-bar-wrap">
                <span
                  className={`stats-eng-bar stats-eng-bar--${row.color}`}
                  style={{ ['--w' as string]: `${Math.round((row.value / maxEng) * 100)}%` }}
                />
              </span>
              <span className={`stats-eng-value stats-top-value--${row.color}`}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {!hasData && (
        <div className="studio-empty-card studio-mt-xl">
          <p className="studio-empty-card__text">No listener activity yet.</p>
          <p className="studio-empty-card__hint">
            Stats appear once listeners play tracks, download sets, or use your smart links.
          </p>
        </div>
      )}
    </PageShell>
  )
}
