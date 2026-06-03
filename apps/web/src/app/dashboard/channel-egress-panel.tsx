// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Panel, Text } from '@/components/ui'

export interface EgressDailyPoint {
  date: string
  bytes: number
  downloads: number
}

function formatMb(bytes: number): string {
  if (bytes < 1_000_000) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1_000_000).toFixed(2)} MB`
}

export function ChannelEgressPanel({
  stats,
}: {
  stats: {
    windowDays: number
    totalBytes: number
    totalDownloads: number
    daily: EgressDailyPoint[]
  } | null
}) {
  if (!stats || stats.totalDownloads === 0) return null

  const max = Math.max(1, ...stats.daily.map((d) => d.bytes))

  return (
    <Panel
      title="Download bandwidth (last 30 days)"
      headerTight
      description={
        <Text size="sm" tone="muted">
          Egress attributed from archive downloads — helps estimate hosting cost per channel.
        </Text>
      }
    >
      <Text size="sm" style={{ marginBottom: '0.75rem' }}>
        <strong>{formatMb(stats.totalBytes)}</strong> served ·{' '}
        <strong>{stats.totalDownloads}</strong> downloads
      </Text>
      <div
        role="img"
        aria-label="Download bandwidth chart"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 3,
          height: 56,
          marginBottom: '0.5rem',
        }}
      >
        {stats.daily.map((d) => {
          const h = Math.round((d.bytes / max) * 100)
          return (
            <div
              key={d.date}
              title={`${d.date}: ${formatMb(d.bytes)}, ${d.downloads} downloads`}
              style={{
                flex: 1,
                minWidth: 0,
                height: `${Math.max(h, d.bytes > 0 ? 10 : 2)}%`,
                minHeight: d.bytes > 0 ? 4 : 2,
                background: '#059669',
                borderRadius: 2,
              }}
            />
          )
        })}
      </div>
      <Text size="sm" tone="muted">
        UTC daily totals (HLS live egress not included yet)
      </Text>
    </Panel>
  )
}
