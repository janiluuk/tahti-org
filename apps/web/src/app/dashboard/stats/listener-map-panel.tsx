'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// PLAT-065: SVG choropleth world map of listener countries (downloads + HLS plays).

import { useState } from 'react'
import { CountryChoroplethMap, type GeoPoint } from '@/components/country-choropleth-map'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

type Period = '7d' | '30d' | 'all'

type Props = {
  initial: GeoPoint[]
  initialPeriod: Period
}

const PERIOD_LABELS: Record<Period, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
}

export function ListenerMapPanel({ initial, initialPeriod }: Props) {
  const [period, setPeriod] = useState<Period>(initialPeriod)
  const [data, setData] = useState<GeoPoint[]>(initial)
  const [loading, setLoading] = useState(false)

  async function changePeriod(p: Period) {
    if (p === period) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/me/listener-geo?period=${p}`, {
        credentials: 'include',
      })
      if (res.ok) {
        const json = await res.json()
        setData(json.geo as GeoPoint[])
      }
    } finally {
      setPeriod(p)
      setLoading(false)
    }
  }

  return (
    <div className="stats-panel stats-panel--map">
      <div className="stats-panel-header">
        <span className="stats-section-label">LISTENER MAP</span>
        <div className="stats-period-tabs" role="tablist" aria-label="Map time period">
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
        data={data}
        loading={loading}
        countLabel="listeners"
        emptyHint="No listener location data yet. Plays and downloads will appear here."
      />
    </div>
  )
}
