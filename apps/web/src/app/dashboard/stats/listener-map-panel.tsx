'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// PLAT-065: SVG choropleth world map of listener countries (downloads + HLS plays).

import dynamic from 'next/dynamic'
import type { GeoPoint } from '@/components/country-choropleth-map'

// react-simple-maps (d3-geo/d3-scale) is large — lazy-load it instead of
// paying for it in the initial dashboard bundle.
const CountryChoroplethMap = dynamic(
  () =>
    import('@/components/country-choropleth-map').then((m) => ({
      default: m.CountryChoroplethMap,
    })),
  { ssr: false },
)

type Props = {
  initial: GeoPoint[]
}

/** Pure display — the time period is the shared page-level control (see
 * stats/page.tsx's stats-range-tabs, driving every tab from one ?range=
 * URL param) rather than a second, independent period toggle in here. */
export function ListenerMapPanel({ initial }: Props) {
  return (
    <div className="stats-panel stats-panel--map">
      <div className="stats-panel-header">
        <span className="stats-section-label">LISTENER MAP</span>
      </div>

      <CountryChoroplethMap
        data={initial}
        loading={false}
        countLabel="listeners"
        emptyHint="No listener location data yet. Plays and downloads will appear here."
      />
    </div>
  )
}
