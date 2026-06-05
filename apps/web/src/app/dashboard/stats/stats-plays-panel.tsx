'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useCallback, useEffect, useState } from 'react'

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

const RANGES: Range[] = ['7', '30', 'all']

function formatAxisDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

export function StatsPlaysPanel({ initial }: { initial: PlaysPayload }) {
  const [range, setRange] = useState<Range>(initial.range)
  const [data, setData] = useState<PlaysPayload>(initial)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (next: Range) => {
    setLoading(true)
    try {
      const res = await fetch(`${apiBase}/api/me/stats/plays?range=${next}`, {
        credentials: 'include',
      })
      if (res.ok) setData((await res.json()) as PlaysPayload)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (range !== initial.range) void load(range)
  }, [range, initial.range, load])

  const maxPlays = Math.max(1, ...data.daily.map((d) => d.plays))
  const label = range === '7' ? '7 DAYS' : range === '30' ? '30 DAYS' : 'ALL TIME'

  return (
    <div className={`stats-panel${loading ? ' stats-panel--loading' : ''}`}>
      <div className="stats-panel-header">
        <span className="stats-section-label">PLAYS — LAST {label}</span>
        <div className="stats-range-toggle" role="group" aria-label="Plays time range">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              className={`stats-range-btn${range === r ? ' stats-range-btn--active' : ''}`}
              onClick={() => setRange(r)}
            >
              {r === 'all' ? 'All' : `${r}d`}
            </button>
          ))}
        </div>
      </div>
      <p className="stats-panel-total">{data.totalPlays.toLocaleString()} total plays</p>
      <div role="img" aria-label="Plays chart" className="studio-chart studio-chart--tall">
        {data.daily.map((d) => {
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
        {data.daily.length > 0 && (
          <>
            <span>{formatAxisDate(data.daily[0]!.date)}</span>
            {data.daily.length > 2 && (
              <span>{formatAxisDate(data.daily[Math.floor(data.daily.length / 2)]!.date)}</span>
            )}
            <span>{formatAxisDate(data.daily[data.daily.length - 1]!.date)}</span>
          </>
        )}
      </div>
    </div>
  )
}
