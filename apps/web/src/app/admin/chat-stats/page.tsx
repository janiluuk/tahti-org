// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { cookies } from 'next/headers'

function boardFetch(path: string) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  return fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
}

interface TimeseriesPoint {
  date: string
  count: number
}

function ChatVolumeChart({ series }: { series: TimeseriesPoint[] }) {
  const max = Math.max(1, ...series.map((p) => p.count))
  const width = 720
  const height = 220
  const barGap = 2
  const barWidth = series.length > 0 ? width / series.length - barGap : 0

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Chat messages per day"
      style={{ width: '100%', height: 'auto' }}
    >
      {series.map((point, i) => {
        const barHeight = (point.count / max) * (height - 24)
        const x = i * (barWidth + barGap)
        const y = height - 24 - barHeight
        return (
          <g key={point.date}>
            <rect
              x={x}
              y={y}
              width={Math.max(1, barWidth)}
              height={barHeight}
              fill="var(--accent, #8b5cf6)"
              rx={1}
            >
              <title>
                {point.date}: {point.count}
              </title>
            </rect>
          </g>
        )
      })}
      <line x1={0} y1={height - 24} x2={width} y2={height - 24} stroke="var(--border)" />
    </svg>
  )
}

export default async function AdminChatStatsPage() {
  const res = await boardFetch('/api/admin/stats/chat-timeseries?days=30')
  const data = res.ok
    ? ((await res.json()) as { days: number; series: TimeseriesPoint[] })
    : { days: 30, series: [] }

  const total = data.series.reduce((sum, p) => sum + p.count, 0)
  const busiestDay = data.series.reduce(
    (best, p) => (p.count > (best?.count ?? -1) ? p : best),
    null as TimeseriesPoint | null,
  )

  return (
    <>
      <p style={{ marginBottom: '0.5rem' }}>
        <Link href="/admin/dashboard">← Dashboard</Link>
      </p>
      <h1 className="admin-section-title">Chat messages over time</h1>

      <section className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <p className="admin-stat">{total.toLocaleString('fi-FI')}</p>
        <p className="admin-stat-sub">
          Last {data.days} days
          {busiestDay
            ? ` · busiest day ${busiestDay.date} (${busiestDay.count.toLocaleString('fi-FI')})`
            : ''}
        </p>
      </section>

      <section className="admin-card">
        {data.series.length === 0 ? (
          <p className="admin-stat-sub">No chat activity in this window.</p>
        ) : (
          <ChatVolumeChart series={data.series} />
        )}
      </section>
    </>
  )
}
