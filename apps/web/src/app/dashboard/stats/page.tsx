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
import { StatsWhatChanged } from './_stats-what-changed'

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
  units: number
  eligible: boolean
  freeDownloads: number
  paidDownloads: number
  fanSubEuros: number
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

const RANGES = [
  { value: '7', label: '7d' },
  { value: '30', label: '30d' },
  { value: 'all', label: 'All' },
] as const

const PERIOD_LABEL: Record<string, string> = {
  '7': 'this week',
  '30': 'this month',
  all: 'all time',
}

const COMPARISON_LABEL: Record<string, string> = {
  '7': 'the previous 7 days',
  '30': 'the previous 30 days',
}

export default async function StatsPage({ searchParams }: { searchParams: { range?: string } }) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const range = RANGES.some((r) => r.value === searchParams.range) ? searchParams.range! : '30'

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const cookie = `tahti_session=${sessionCookie.value}`

  const [plays, topTracks, topCountries, grantEstimate, allDaily] = await Promise.all([
    apiFetch<PlaysPayload>(apiUrl, cookie, `/api/me/stats/plays?range=${range}`),
    apiFetch<{ items: TopTrack[] }>(apiUrl, cookie, `/api/me/stats/top-tracks?range=${range}`),
    apiFetch<{ items: TopCountry[] }>(apiUrl, cookie, `/api/me/stats/top-countries?range=${range}`),
    apiFetch<GrantEstimate>(apiUrl, cookie, '/api/me/grants/estimate'),
    range === 'all'
      ? null
      : apiFetch<PlaysPayload>(apiUrl, cookie, '/api/me/stats/plays?range=all'),
  ])

  const totalPlays = plays?.totalPlays ?? 0
  const tracks = topTracks?.items ?? []
  const countries = topCountries?.items ?? []

  // Engagement units — the canonical free/paid-download + fan-sub-euro weighting
  // from @tahti/ledger (computeEngagementUnits), the same formula used for real
  // grant disbursement. Never recomputed here, only displayed.
  const freeDownloads = grantEstimate?.freeDownloads ?? 0
  const paidDownloads = grantEstimate?.paidDownloads ?? 0
  const fanSubEuros = grantEstimate?.fanSubEuros ?? 0
  const totalUnits = grantEstimate?.units ?? freeDownloads + paidDownloads * 5 + fanSubEuros
  const engagementUnits = [
    { label: `${freeDownloads} free dl × 1`, value: freeDownloads, color: 'green' as const },
    { label: `${paidDownloads} paid dl × 5`, value: paidDownloads * 5, color: 'cyan' as const },
    { label: `€${fanSubEuros}/yr fan-subs × 1`, value: fanSubEuros, color: 'purple' as const },
  ]
  const maxEng = Math.max(1, ...engagementUnits.map((e) => e.value))

  const daily = plays?.daily ?? []
  const busiestDay = daily.length > 0 ? daily.reduce((a, b) => (b.plays > a.plays ? b : a)) : null

  // Hero comparison: current period vs. the immediately preceding period of the
  // same length. The selected range's own daily series is too short for this
  // when range is 7d/30d, so pull the full history once to slice both windows.
  const comparisonDaily = range === 'all' ? daily : (allDaily?.daily ?? [])
  const periodDays = range === '7' ? 7 : range === '30' ? 30 : null
  const currentWindow = periodDays ? comparisonDaily.slice(-periodDays) : comparisonDaily
  const prevWindow = periodDays
    ? comparisonDaily.slice(-periodDays * 2, -periodDays)
    : ([] as typeof comparisonDaily)
  const periodPlays = currentWindow.reduce((sum, d) => sum + d.plays, 0)
  const prevPeriodPlays = prevWindow.reduce((sum, d) => sum + d.plays, 0)
  const hasEnoughHistory = periodDays != null && comparisonDaily.length >= periodDays * 2

  const hasData = totalPlays > 0 || tracks.length > 0 || countries.length > 0
  const user = await getDashboardUser()

  return (
    <PageShell size="md">
      <div className="studio-page-header">
        <div>
          <Heading level={1}>Stats</Heading>
        </div>
        <div className="studio-page-header__actions">
          <div className="stats-range-tabs" role="group" aria-label="Period">
            {RANGES.map((r) => (
              <NextLink
                key={r.value}
                href={`/dashboard/stats?range=${r.value}`}
                className={`stats-range-tab${range === r.value ? ' stats-range-tab--active' : ''}`}
                aria-current={range === r.value ? 'true' : undefined}
              >
                {r.label}
              </NextLink>
            ))}
          </div>
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
        periodPlays={periodPlays}
        prevPeriodPlays={prevPeriodPlays}
        hasEnoughHistory={hasEnoughHistory}
        periodLabel={PERIOD_LABEL[range] ?? 'this period'}
        comparisonLabel={COMPARISON_LABEL[range] ?? ''}
      />

      <StatsWhatChanged daily={daily} busiestDay={busiestDay} />

      <StatsTopThree
        bestTrack={tracks[0] ? { title: tracks[0].title, plays: tracks[0].plays } : null}
        bestCountry={
          countries[0] ? { country: countries[0].country, count: countries[0].count } : null
        }
        busiestDay={busiestDay}
      />

      <div className="stats-panel">
        <div className="stats-panel-header">
          <span className="stats-section-label">ENGAGEMENT UNITS · {grantEstimate?.year}</span>
          <span className="stats-eng-total">{totalUnits}</span>
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
