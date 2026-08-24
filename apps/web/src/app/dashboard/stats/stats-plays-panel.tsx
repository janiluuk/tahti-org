// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

type Range = '7' | '30' | 'all'

interface PlaysDaily {
  date: string
  plays: number
}

interface PlaysPayload {
  range: Range
  totalPlays: number
  daily: PlaysDaily[]
}

function formatAxisDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Pure display — the time range is the shared page-level control (see
 * stats/page.tsx's stats-range-tabs, driving every tab from one ?range=
 * URL param) rather than a second, independent range toggle in here. */
export function StatsPlaysPanel({ initial }: { initial: PlaysPayload }) {
  const maxPlays = Math.max(1, ...initial.daily.map((d) => d.plays))
  const label = initial.range === '7' ? '7 DAYS' : initial.range === '30' ? '30 DAYS' : 'ALL TIME'

  return (
    <div className="stats-panel">
      <div className="stats-panel-header">
        <span className="stats-section-label">PLAYS — LAST {label}</span>
      </div>
      <p className="stats-panel-total">{initial.totalPlays.toLocaleString()} total plays</p>
      <div role="img" aria-label="Plays chart" className="studio-chart studio-chart--tall">
        {initial.daily.map((d) => {
          const pct = Math.round((d.plays / maxPlays) * 100)
          return (
            <div
              key={d.date}
              title={`${d.date}: ${d.plays} plays`}
              className="studio-chart-bar studio-chart-bar--plays"
              style={{
                ['--studio-bar-pct' as string]: `${Math.max(pct, d.plays > 0 ? 10 : 2)}%`,
                ['--studio-bar-min' as string]: `${d.plays > 0 ? 4 : 2}px`,
              }}
            />
          )
        })}
      </div>
      <div className="stats-chart-axis" aria-hidden>
        {initial.daily.length > 0 && (
          <>
            <span>{formatAxisDate(initial.daily[0]!.date)}</span>
            {initial.daily.length > 2 && (
              <span>
                {formatAxisDate(initial.daily[Math.floor(initial.daily.length / 2)]!.date)}
              </span>
            )}
            <span>{formatAxisDate(initial.daily[initial.daily.length - 1]!.date)}</span>
          </>
        )}
      </div>
    </div>
  )
}
