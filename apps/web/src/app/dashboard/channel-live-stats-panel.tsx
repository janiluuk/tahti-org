// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Panel, Text } from '@/components/ui'

export interface LiveDailyPoint {
  date: string
  liveSeconds: number
  broadcastCount: number
  listeners: number
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  return `${m}m`
}

export function ChannelLiveStatsPanel({
  stats,
}: {
  stats: {
    windowDays: number
    totalLiveSeconds: number
    totalBroadcasts: number
    peakDailyListeners: number
    daily: LiveDailyPoint[]
  } | null
}) {
  if (!stats || stats.totalLiveSeconds === 0) return null

  const max = Math.max(1, ...stats.daily.map((d) => d.liveSeconds))
  const hasListenerData = stats.peakDailyListeners > 0

  return (
    <Panel
      title="Live broadcast time (last 14 days)"
      headerTight
      description={
        <Text size="sm" tone="muted">
          UTC daily live seconds from ended broadcasts, with distinct daily HLS listeners measured
          from anonymized edge logs — never tracked across days, never used for grant shares.
        </Text>
      }
    >
      <Text size="sm" className="studio-mb-md">
        <strong>{formatDuration(stats.totalLiveSeconds)}</strong> on air ·{' '}
        <strong>{stats.totalBroadcasts}</strong> sessions
        {hasListenerData && (
          <>
            {' · '}
            <strong>{stats.peakDailyListeners}</strong> listeners on your best day
          </>
        )}
      </Text>
      <div role="img" aria-label="Live broadcast duration chart" className="studio-chart">
        {stats.daily.map((d) => {
          const h = Math.round((d.liveSeconds / max) * 100)
          const minH = d.liveSeconds > 0 ? 4 : 2
          const barPct = Math.max(h, d.liveSeconds > 0 ? 10 : 2)
          const listenerNote = d.listeners > 0 ? `, ${d.listeners} listeners` : ''
          return (
            <div
              key={d.date}
              title={`${d.date}: ${formatDuration(d.liveSeconds)}, ${d.broadcastCount} broadcasts${listenerNote}`}
              className="studio-chart-bar studio-chart-bar--live"
              style={{
                ['--studio-bar-pct' as string]: `${barPct}%`,
                ['--studio-bar-min' as string]: `${minH}px`,
              }}
            />
          )
        })}
      </div>
    </Panel>
  )
}
