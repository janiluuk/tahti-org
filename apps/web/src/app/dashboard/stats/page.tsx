// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import NextLink from 'next/link'
import { Heading, PageShell, SidebarNavIconSvg } from '@tahti/ui'
import { getDashboardUser } from '@/lib/dashboard-session'
import { StudioHeaderActions } from '../_studio-header-actions'
import { StatsHero } from './_stats-hero'
import { StatsTopThree } from './_stats-top-three'

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

interface GrantEstimate {
  year: number
  estimateCents: number
  eligible: boolean
}

function eur(cents: number): string {
  return `€${(Number.isFinite(cents) ? cents / 100 : 0).toFixed(2)}`
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

  const [plays, topTracks, topCountries, fanPayouts, grantEstimate] = await Promise.all([
    apiFetch<PlaysPayload>(apiUrl, cookie, '/api/me/stats/plays?range=30'),
    apiFetch<{ items: TopTrack[] }>(apiUrl, cookie, '/api/me/stats/top-tracks'),
    apiFetch<{ items: TopCountry[] }>(apiUrl, cookie, '/api/me/stats/top-countries'),
    apiFetch<FanPayoutStats>(apiUrl, cookie, '/api/me/fan-sub-payouts'),
    apiFetch<GrantEstimate>(apiUrl, cookie, '/api/me/grants/estimate'),
  ])

  const downloads = plays?.totalDownloads ?? 0
  const totalPlays = plays?.totalPlays ?? 0
  const fanSubs = fanPayouts?.activeSubscribers ?? 0

  const tracks = topTracks?.items ?? []
  const countries = topCountries?.items ?? []

  const engagementUnits = [
    { label: `${downloads} downloads × 1`, value: downloads, color: 'green' as const },
    { label: `${totalPlays} plays × 1`, value: totalPlays, color: 'amber' as const },
    { label: `${fanSubs} fan-subs × 1`, value: fanSubs, color: 'purple' as const },
  ]
  const maxEng = Math.max(1, ...engagementUnits.map((e) => e.value))

  const daily = plays?.daily ?? []
  const last7 = daily.slice(-7)
  const prev7 = daily.slice(-14, -7)
  const last7Plays = last7.reduce((sum, d) => sum + d.plays, 0)
  const prev7Plays = prev7.reduce((sum, d) => sum + d.plays, 0)
  const busiestDay = daily.length > 0 ? daily.reduce((a, b) => (b.plays > a.plays ? b : a)) : null

  const hasData = totalPlays > 0 || tracks.length > 0 || countries.length > 0
  const user = await getDashboardUser()

  return (
    <PageShell size="md">
      <div className="studio-page-header">
        <div>
          <Heading level={1}>Stats</Heading>
        </div>
        <div className="studio-page-header__actions">
          <NextLink href="/dashboard/stats/detail" className="ui-btn ui-btn--sm ui-btn--secondary">
            Plays &amp; listeners →
          </NextLink>
          <StudioHeaderActions
            hasChannel={Boolean(user?.channel)}
            isLive={user?.channel?.state === 'LIVE'}
            channelSlug={user?.channel?.slug}
            showBack
          />
        </div>
      </div>

      {!hasData ? (
        <div className="studio-empty-card studio-mb-md">
          <p className="studio-empty-card__text">No listener activity yet.</p>
          <p className="studio-empty-card__hint">
            Stats appear once listeners play tracks, download sets, or use your smart links.
          </p>
          <div className="db-quick-actions db-quick-actions--centered studio-mt-md">
            <NextLink href="/dashboard/upload" className="db-quick-action db-quick-action--primary">
              <SidebarNavIconSvg name="upload" />
              Upload a set
            </NextLink>
            <NextLink href="/dashboard/broadcast" className="db-quick-action">
              <SidebarNavIconSvg name="distribution" />
              Go live
            </NextLink>
          </div>
        </div>
      ) : null}

      <StatsHero
        last7Plays={last7Plays}
        prev7Plays={prev7Plays}
        hasEnoughHistory={daily.length >= 14}
      />

      <StatsTopThree
        bestTrack={tracks[0] ? { title: tracks[0].title, plays: tracks[0].plays } : null}
        bestCountry={
          countries[0] ? { country: countries[0].country, count: countries[0].count } : null
        }
        busiestDay={busiestDay}
      />

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
        {grantEstimate && (
          <p className="stats-eng-grant-note">
            {grantEstimate.eligible
              ? `At this rate, your estimated share of the ${grantEstimate.year} grant pool is ~${eur(grantEstimate.estimateCents)}.`
              : `Keep going — you need more engagement units to qualify for the ${grantEstimate.year} grant pool.`}
          </p>
        )}
      </div>
    </PageShell>
  )
}
