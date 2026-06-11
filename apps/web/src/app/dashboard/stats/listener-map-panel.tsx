'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// PLAT-065: SVG choropleth world map of listener countries (downloads + HLS plays).

import { useState } from 'react'
import { ComposableMap, Geographies, Geography, Sphere, Graticule } from 'react-simple-maps'
import { ISO_NUM_TO_A2 } from '@/lib/iso-numeric-to-a2'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

type Period = '7d' | '30d' | 'all'

type GeoPoint = {
  countryCode: string
  displayName: string
  count: number
}

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
  const [tooltip, setTooltip] = useState<{ name: string; count: number } | null>(null)

  async function changePeriod(p: Period) {
    if (p === period) return
    setLoading(true)
    try {
      const res = await fetch(`/api/me/listener-geo?period=${p}`)
      if (res.ok) {
        const json = await res.json()
        setData(json.geo as GeoPoint[])
      }
    } finally {
      setPeriod(p)
      setLoading(false)
    }
  }

  const maxCount = Math.max(1, ...data.map((d) => d.count))
  const countByCode = Object.fromEntries(data.map((d) => [d.countryCode, d.count]))
  const nameByCode = Object.fromEntries(data.map((d) => [d.countryCode, d.displayName]))

  function fillForCount(count: number): string {
    const t = count / maxCount
    if (t === 0) return 'var(--map-fill-empty)'
    const pct = Math.round(t * 100)
    return `color-mix(in srgb, var(--cyan) ${Math.max(12, pct)}%, var(--map-fill-empty))`
  }

  const top10 = [...data].sort((a, b) => b.count - a.count).slice(0, 10)

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

      <div className="listener-map-wrap" aria-busy={loading}>
        <ComposableMap
          projection="geoNaturalEarth1"
          projectionConfig={{ scale: 147 }}
          width={800}
          height={400}
          style={{ width: '100%', height: 'auto' }}
        >
          <Sphere id="rsm-sphere" stroke="var(--map-border)" strokeWidth={0.5} fill="transparent" />
          <Graticule stroke="var(--map-grid)" strokeWidth={0.3} />
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const cc = ISO_NUM_TO_A2[Number(geo.id)]
                const count = cc ? (countByCode[cc] ?? 0) : 0
                const displayName = cc ? (nameByCode[cc] ?? cc) : ''
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={fillForCount(count)}
                    stroke="var(--map-border)"
                    strokeWidth={0.4}
                    style={{
                      default: { outline: 'none' },
                      hover: {
                        outline: 'none',
                        fill:
                          count > 0
                            ? 'color-mix(in srgb, var(--cyan) 75%, white)'
                            : 'var(--map-fill-hover)',
                      },
                      pressed: { outline: 'none' },
                    }}
                    onMouseEnter={() => cc && count > 0 && setTooltip({ name: displayName, count })}
                    onMouseLeave={() => setTooltip(null)}
                  />
                )
              })
            }
          </Geographies>
        </ComposableMap>

        {tooltip && (
          <div className="map-tooltip" role="tooltip">
            <span className="map-tooltip-name">{tooltip.name}</span>
            <span className="map-tooltip-count">{tooltip.count.toLocaleString()} listeners</span>
          </div>
        )}
      </div>

      {top10.length > 0 && (
        <ol className="map-top-list" aria-label="Top 10 listener countries">
          {top10.map((d, i) => (
            <li key={d.countryCode} className="map-top-row">
              <span className="map-top-rank">{i + 1}</span>
              <span className="map-top-name">{d.displayName}</span>
              <span className="map-top-bar-wrap">
                <span
                  className="map-top-bar"
                  style={{ ['--w' as string]: `${Math.round((d.count / maxCount) * 100)}%` }}
                />
              </span>
              <span className="map-top-count">{d.count.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}

      {data.length === 0 && !loading && (
        <p className="studio-text-muted-sm studio-mt-sm">
          No listener location data yet. Plays and downloads will appear here.
        </p>
      )}
    </div>
  )
}
