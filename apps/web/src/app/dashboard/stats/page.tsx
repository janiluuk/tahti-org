// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Heading, PageShell } from '@tahti/ui'

interface FunnelStats {
  downloadGates: {
    windowDays: number
    totals: { repostAcks: number; blockedAttempts: number; countedDownloads?: number }
    daily?: Array<{
      date: string
      repostAcks: number
      blockedAttempts: number
      countedDownloads: number
    }>
    items: Array<{
      archiveItemId: string
      title: string
      repostToDownload: boolean
      followToDownload: boolean
      repostAckCount: number
      blockedDownloadAttempts: number
      countedDownloadCount?: number
    }>
  }
  live: {
    windowDays: number
    totalLiveSeconds: number
    totalBroadcasts: number
    daily: Array<{ date: string; liveSeconds: number; broadcastCount: number }>
  }
  egress: {
    windowDays: number
    totalBytes: number
    totalDownloads: number
    daily: Array<{ date: string; bytes: number; downloads: number }>
  }
}

interface NewsletterStats {
  total: number
  confirmed: number
  newLast30Days: number
}

interface FanPayoutStats {
  pending: number
  failed: number
  paidLast30Days: number
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  return `${m}m`
}

export default async function StatsPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get('tahti_session')
  if (!sessionCookie) redirect('/login')

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const cookie = `tahti_session=${sessionCookie.value}`

  let funnel: FunnelStats | null = null
  let newsletterStats: NewsletterStats = { total: 0, confirmed: 0, newLast30Days: 0 }
  let fanPayoutStats: FanPayoutStats = { pending: 0, failed: 0, paidLast30Days: 0 }

  try {
    const [funnelRes, nlRes, payoutRes] = await Promise.all([
      fetch(`${apiUrl}/api/me/channel-funnel-stats`, {
        headers: { Cookie: cookie },
        cache: 'no-store',
      }),
      fetch(`${apiUrl}/api/me/newsletter/subscribers`, {
        headers: { Cookie: cookie },
        cache: 'no-store',
      }),
      fetch(`${apiUrl}/api/me/fan-sub-payouts`, { headers: { Cookie: cookie }, cache: 'no-store' }),
    ])
    if (funnelRes.ok) funnel = (await funnelRes.json()) as FunnelStats
    if (nlRes.ok) newsletterStats = (await nlRes.json()) as NewsletterStats
    if (payoutRes.ok) fanPayoutStats = (await payoutRes.json()) as FanPayoutStats
  } catch {
    // ignore
  }

  const downloads = funnel?.downloadGates.totals.countedDownloads ?? 0
  const broadcasts = funnel?.live.totalBroadcasts ?? 0
  const liveSeconds = funnel?.live.totalLiveSeconds ?? 0
  const revenueCents = fanPayoutStats.paidLast30Days
  const subscribers = newsletterStats.confirmed

  // Top archive items by download count
  const topTracks = [...(funnel?.downloadGates.items ?? [])]
    .sort((a, b) => (b.countedDownloadCount ?? 0) - (a.countedDownloadCount ?? 0))
    .slice(0, 5)

  // Egress bar chart data
  const egressDaily = funnel?.egress.daily ?? []
  const maxEgress = Math.max(1, ...egressDaily.map((d) => d.bytes))

  // Live seconds bar chart data
  const liveDaily = funnel?.live.daily ?? []
  const maxLive = Math.max(1, ...liveDaily.map((d) => d.liveSeconds))

  return (
    <PageShell size="md">
      <div className="studio-page-header">
        <Heading level={1}>Stats</Heading>
      </div>

      {/* ── 4-up stat tiles ── */}
      <div className="db-stat-tiles">
        <div className="db-stat-tile db-stat-tile--amber">
          <span className="db-stat-tile-value">{broadcasts}</span>
          <span className="db-stat-tile-label">Broadcasts</span>
        </div>
        <div className="db-stat-tile db-stat-tile--cyan">
          <span className="db-stat-tile-value">{downloads}</span>
          <span className="db-stat-tile-label">Downloads</span>
        </div>
        <div className="db-stat-tile db-stat-tile--purple">
          <span className="db-stat-tile-value">{subscribers}</span>
          <span className="db-stat-tile-label">Subscribers</span>
        </div>
        <div className="db-stat-tile db-stat-tile--cyan">
          <span className="db-stat-tile-value">€{(revenueCents / 100).toFixed(0)}</span>
          <span className="db-stat-tile-label">Revenue / mo</span>
        </div>
      </div>

      {/* ── Live time bar chart ── */}
      {liveSeconds > 0 && (
        <div className="stats-panel">
          <div className="stats-panel-header">
            <span className="stats-section-label">LIVE TIME — LAST 14 DAYS</span>
            <span className="stats-panel-total">
              {formatDuration(liveSeconds)} on air · {broadcasts} sessions
            </span>
          </div>
          <div
            role="img"
            aria-label="Live broadcast chart"
            className="studio-chart studio-chart--tall"
          >
            {liveDaily.map((d) => {
              const pct = Math.round((d.liveSeconds / maxLive) * 100)
              return (
                <div
                  key={d.date}
                  title={`${d.date}: ${formatDuration(d.liveSeconds)}`}
                  className="studio-chart-bar studio-chart-bar--live"
                  style={{
                    ['--studio-bar-pct' as string]: `${Math.max(pct, d.liveSeconds > 0 ? 10 : 2)}%`,
                    ['--studio-bar-min' as string]: `${d.liveSeconds > 0 ? 4 : 2}px`,
                  }}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* ── Downloads bar chart ── */}
      {downloads > 0 && (
        <div className="stats-panel">
          <div className="stats-panel-header">
            <span className="stats-section-label">DOWNLOADS — LAST 30 DAYS</span>
            <span className="stats-panel-total">{downloads} total</span>
          </div>
          <div role="img" aria-label="Downloads chart" className="studio-chart studio-chart--tall">
            {egressDaily.map((d) => {
              const pct = Math.round((d.bytes / maxEgress) * 100)
              return (
                <div
                  key={d.date}
                  title={`${d.date}: ${d.downloads} downloads`}
                  className="studio-chart-bar studio-chart-bar--egress"
                  style={{
                    ['--studio-bar-pct' as string]: `${Math.max(pct, d.bytes > 0 ? 10 : 2)}%`,
                    ['--studio-bar-min' as string]: `${d.bytes > 0 ? 4 : 2}px`,
                  }}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* ── Top tracks + engagement ── */}
      {topTracks.length > 0 && (
        <div className="stats-two-col">
          <div className="stats-panel">
            <div className="stats-panel-header">
              <span className="stats-section-label">TOP TRACKS</span>
            </div>
            <ol className="stats-top-list">
              {topTracks.map((t, i) => (
                <li key={t.archiveItemId} className="stats-top-row">
                  <span className="stats-top-rank">{i + 1}</span>
                  <span className="stats-top-name">{t.title}</span>
                  <span className="stats-top-value stats-top-value--amber">
                    {t.countedDownloadCount ?? 0}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="stats-panel">
            <div className="stats-panel-header">
              <span className="stats-section-label">ENGAGEMENT</span>
            </div>
            <div className="stats-engagement-rows">
              <div className="stats-eng-row">
                <span className="stats-eng-label">{downloads} downloads × 1</span>
                <span className="stats-eng-bar-wrap">
                  <span
                    className="stats-eng-bar stats-eng-bar--cyan"
                    style={{ ['--w' as string]: '60%' }}
                  />
                </span>
                <span className="stats-eng-value stats-top-value--cyan">{downloads}</span>
              </div>
              <div className="stats-eng-row">
                <span className="stats-eng-label">{broadcasts} live sessions × 5</span>
                <span className="stats-eng-bar-wrap">
                  <span
                    className="stats-eng-bar stats-eng-bar--amber"
                    style={{ ['--w' as string]: '40%' }}
                  />
                </span>
                <span className="stats-eng-value stats-top-value--amber">{broadcasts * 5}</span>
              </div>
              <div className="stats-eng-row">
                <span className="stats-eng-label">{subscribers} subscribers × 1</span>
                <span className="stats-eng-bar-wrap">
                  <span
                    className="stats-eng-bar stats-eng-bar--purple"
                    style={{ ['--w' as string]: '20%' }}
                  />
                </span>
                <span className="stats-eng-value stats-top-value--purple">{subscribers}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!funnel && (
        <p className="studio-text-muted-sm studio-mt-xl">
          Stats will appear here once you have archive items or broadcasts.
        </p>
      )}
    </PageShell>
  )
}
