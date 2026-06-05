// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Panel, Text } from '@/components/ui'

export interface EgressDailyPoint {
  date: string
  bytes: number
  downloadBytes: number
  liveHlsBytes: number
  estimatedLiveBytes: number
  downloads: number
}

function formatMb(bytes: number): string {
  if (bytes < 1_000_000) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1_000_000).toFixed(2)} MB`
}

function liveLabel(stats: { liveHlsBytes: number; estimatedLiveHlsBytes: number }): string {
  if (stats.liveHlsBytes > 0) {
    return `${formatMb(stats.liveHlsBytes)} live (edge)`
  }
  if (stats.estimatedLiveHlsBytes > 0) {
    return `${formatMb(stats.estimatedLiveHlsBytes)} live (est.)`
  }
  return '0 live'
}

export function ChannelEgressPanel({
  stats,
}: {
  stats: {
    windowDays: number
    totalBytes: number
    downloadBytes: number
    liveHlsBytes: number
    estimatedLiveHlsBytes: number
    totalDownloads: number
    daily: EgressDailyPoint[]
    liveEstimateNote?: string
  } | null
}) {
  if (
    !stats ||
    (stats.totalDownloads === 0 && stats.liveHlsBytes === 0 && stats.estimatedLiveHlsBytes === 0)
  ) {
    return null
  }

  const max = Math.max(1, ...stats.daily.map((d) => d.bytes))

  return (
    <Panel
      title="Bandwidth (last 30 days)"
      headerTight
      description={
        <Text size="sm" tone="muted">
          Archive downloads plus live HLS egress — helps attribute hosting cost per channel.
        </Text>
      }
    >
      <Text size="sm" className="studio-mb-md">
        <strong>{formatMb(stats.totalBytes)}</strong> total ·{' '}
        <strong>{formatMb(stats.downloadBytes)}</strong> downloads ·{' '}
        <strong>{liveLabel(stats)}</strong> · <strong>{stats.totalDownloads}</strong> download
        events
      </Text>
      <div role="img" aria-label="Bandwidth chart" className="studio-chart">
        {stats.daily.map((d) => {
          const h = Math.round((d.bytes / max) * 100)
          const minH = d.bytes > 0 ? 4 : 2
          const barPct = Math.max(h, d.bytes > 0 ? 10 : 2)
          const livePart =
            d.liveHlsBytes > 0
              ? `${formatMb(d.liveHlsBytes)} live (edge)`
              : `${formatMb(d.estimatedLiveBytes)} live (est.)`
          return (
            <div
              key={d.date}
              title={`${d.date}: ${formatMb(d.bytes)} total (${formatMb(d.downloadBytes)} dl + ${livePart})`}
              className="studio-chart-bar studio-chart-bar--egress"
              style={{
                ['--studio-bar-pct' as string]: `${barPct}%`,
                ['--studio-bar-min' as string]: `${minH}px`,
              }}
            />
          )
        })}
      </div>
      <Text size="sm" tone="muted">
        {stats.liveEstimateNote ??
          'Live HLS uses a one-listener bitrate estimate until edge byte counters ship.'}
      </Text>
    </Panel>
  )
}
