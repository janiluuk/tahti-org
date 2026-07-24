'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState } from 'react'
import { StatCard, StatCardGrid } from '@tahti/ui'
import { CountryChoroplethMap, type GeoPoint } from '@/components/country-choropleth-map'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

type Period = '7d' | '30d' | 'all'

export interface TrackInsightsPayload {
  title: string
  period: Period
  totalDownloads: number
  totalPlays: number
  daily: Array<{ date: string; downloads: number }>
  countries: GeoPoint[]
}

const PERIOD_LABELS: Record<Period, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
}

export function TrackInsightsView({
  apiPath,
  initial,
}: {
  apiPath: string
  initial: TrackInsightsPayload
}) {
  const [period, setPeriod] = useState<Period>(initial.period)
  const [data, setData] = useState<TrackInsightsPayload>(initial)
  const [loading, setLoading] = useState(false)

  async function changePeriod(p: Period) {
    if (p === period) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}${apiPath}?period=${p}`, { credentials: 'include' })
      if (res.ok) setData((await res.json()) as TrackInsightsPayload)
    } finally {
      setPeriod(p)
      setLoading(false)
    }
  }

  // For the 'all' period the API returns a fixed 90-day window — trim leading
  // silent days so a brand-new track doesn't render dozens of all-zero rows,
  // and cap the tail so the list stays a quick scan rather than a wall of days.
  const firstActive = data.daily.findIndex((d) => d.downloads > 0)
  const trimmedDaily =
    firstActive === -1 ? data.daily.slice(-14) : data.daily.slice(firstActive).slice(-30)
  const maxDaily = Math.max(1, ...trimmedDaily.map((d) => d.downloads))

  return (
    <div className="track-insights">
      <StatCardGrid cols={2} aria-label="Track summary">
        <StatCard variant="plays" value={data.totalPlays.toLocaleString()} label="Plays" />
        <StatCard
          variant="downloads"
          value={data.totalDownloads.toLocaleString()}
          label="Downloads"
        />
      </StatCardGrid>

      <div className="stats-panel stats-panel--map studio-mt-md">
        <div className="stats-panel-header">
          <span className="stats-section-label">LISTENER MAP</span>
          <div className="stats-period-tabs" role="tablist" aria-label="Time period">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={period === p}
                className={`stats-period-tab${period === p ? ' active' : ''}`}
                onClick={() => changePeriod(p)}
                disabled={loading}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        <CountryChoroplethMap
          data={data.countries}
          loading={loading}
          countLabel="downloads"
          emptyHint="No location data yet for this track."
        />
      </div>

      {trimmedDaily.length > 0 && (
        <div className="stats-panel studio-mt-md">
          <span className="stats-section-label">DAILY DOWNLOADS</span>
          <ol className="map-top-list studio-mt-sm" aria-label="Daily downloads">
            {trimmedDaily.map((d) => (
              <li key={d.date} className="map-top-row">
                <span className="map-top-name">
                  {new Date(`${d.date}T00:00:00Z`).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                  })}
                </span>
                <span className="map-top-bar-wrap">
                  <span
                    className="map-top-bar"
                    style={{ ['--w' as string]: `${Math.round((d.downloads / maxDaily) * 100)}%` }}
                  />
                </span>
                <span className="map-top-count">{d.downloads.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
