'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Pure presentational SVG choropleth + top-N list, shared by the channel-wide
// listener map (listener-map-panel.tsx) and per-track insights.

import { useState } from 'react'
import { ComposableMap, Geographies, Geography, Sphere, Graticule } from 'react-simple-maps'
import { ISO_NUM_TO_A2 } from '@/lib/iso-numeric-to-a2'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

export type GeoPoint = {
  countryCode: string
  displayName: string
  count: number
}

export function CountryChoroplethMap({
  data,
  loading,
  emptyHint,
  countLabel = 'listeners',
}: {
  data: GeoPoint[]
  loading?: boolean
  emptyHint?: string
  countLabel?: string
}) {
  const [tooltip, setTooltip] = useState<{ name: string; count: number } | null>(null)

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
    <>
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
            <span className="map-tooltip-count">
              {tooltip.count.toLocaleString()} {countLabel}
            </span>
          </div>
        )}
      </div>

      {top10.length > 0 && (
        <ol className="map-top-list" aria-label="Top 10 countries">
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
        <p className="studio-empty studio-mt-sm">{emptyHint ?? 'No location data yet.'}</p>
      )}
    </>
  )
}
