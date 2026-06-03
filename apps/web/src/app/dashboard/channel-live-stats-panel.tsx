// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Panel, Text } from '@/components/ui'

export interface LiveDailyPoint {
  date: string
  liveSeconds: number
  broadcastCount: number
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
    daily: LiveDailyPoint[]
  } | null
}) {
  if (!stats || stats.totalLiveSeconds === 0) return null

  const max = Math.max(1, ...stats.daily.map((d) => d.liveSeconds))

  return (
    <Panel
      title="Live broadcast time (last 14 days)"
      headerTight
      description={
        <Text size="sm" tone="muted">
          UTC daily live seconds from ended broadcasts — listener-level HLS metrics coming later.
        </Text>
      }
    >
      <Text size="sm" style={{ marginBottom: '0.75rem' }}>
        <strong>{formatDuration(stats.totalLiveSeconds)}</strong> on air ·{' '}
        <strong>{stats.totalBroadcasts}</strong> sessions
      </Text>
      <div
        role="img"
        aria-label="Live broadcast duration chart"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 3,
          height: 56,
          marginBottom: '0.5rem',
        }}
      >
        {stats.daily.map((d) => {
          const h = Math.round((d.liveSeconds / max) * 100)
          return (
            <div
              key={d.date}
              title={`${d.date}: ${formatDuration(d.liveSeconds)}, ${d.broadcastCount} broadcasts`}
              style={{
                flex: 1,
                minWidth: 0,
                height: `${Math.max(h, d.liveSeconds > 0 ? 10 : 2)}%`,
                minHeight: d.liveSeconds > 0 ? 4 : 2,
                background: '#7c3aed',
                borderRadius: 2,
              }}
            />
          )
        })}
      </div>
    </Panel>
  )
}
