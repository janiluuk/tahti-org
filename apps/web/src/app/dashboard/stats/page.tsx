// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Heading, PageShell } from '@tahti/ui'
import { StatsPlaysPanel } from './stats-plays-panel'

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

  const [plays, topTracks, topCountries, fanPayouts] = await Promise.all([
    apiFetch<PlaysPayload>(apiUrl, cookie, '/api/me/stats/plays?range=30'),
    apiFetch<{ items: TopTrack[] }>(apiUrl, cookie, '/api/me/stats/top-tracks'),
    apiFetch<{ items: TopCountry[] }>(apiUrl, cookie, '/api/me/stats/top-countries'),
    apiFetch<FanPayoutStats>(apiUrl, cookie, '/api/me/fan-sub-payouts'),
  ])

  const downloads = plays?.totalDownloads ?? 0
  const totalPlays = plays?.totalPlays ?? 0
  const fanSubs = fanPayouts?.activeSubscribers ?? 0
  const revenueCents = fanPayouts?.paidLast30Days ?? 0

  const tracks = topTracks?.items ?? []
  const countries = topCountries?.items ?? []
  const maxCountry = Math.max(1, ...countries.map((c) => c.count))

  const engagementUnits = [
    { label: `${downloads} downloads × 1`, value: downloads, color: 'cyan' as const },
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

      <div className="db-stat-tiles">
        <div className="db-stat-tile db-stat-tile--amber">
          <span className="db-stat-tile-value">{totalPlays.toLocaleString()}</span>
          <span className="db-stat-tile-label">Plays</span>
        </div>
        <div className="db-stat-tile db-stat-tile--cyan">
          <span className="db-stat-tile-value">{downloads.toLocaleString()}</span>
          <span className="db-stat-tile-label">Downloads</span>
        </div>
        <div className="db-stat-tile db-stat-tile--purple">
          <span className="db-stat-tile-value">{fanSubs.toLocaleString()}</span>
          <span className="db-stat-tile-label">Fan subs</span>
        </div>
        <div className="db-stat-tile db-stat-tile--cyan">
          <span className="db-stat-tile-value">€{(revenueCents / 100).toFixed(0)}</span>
          <span className="db-stat-tile-label">Revenue / mo</span>
        </div>
      </div>

      {plays && <StatsPlaysPanel initial={plays} />}

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
        <p className="studio-text-muted-sm studio-mt-xl">
          Stats will appear here once listeners download tracks or click your smart links.
        </p>
      )}
    </PageShell>
  )
}
