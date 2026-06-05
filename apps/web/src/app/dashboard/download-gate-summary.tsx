// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Panel, Text } from '@/components/ui'

export interface GateSummaryItem {
  archiveItemId: string
  title: string
  repostToDownload: boolean
  followToDownload: boolean
  repostAckCount: number
  blockedDownloadAttempts: number
  countedDownloadCount?: number
}

export interface GateDailyPoint {
  date: string
  repostAcks: number
  blockedAttempts: number
  countedDownloads: number
}

export function DownloadGateSummaryPanel({
  summary,
}: {
  summary: {
    artistFollowerCount: number
    totals: { repostAcks: number; blockedAttempts: number; countedDownloads?: number }
    items: GateSummaryItem[]
    daily?: GateDailyPoint[]
  } | null
}) {
  if (!summary || summary.items.length === 0) return null

  return (
    <Panel
      title="Download gate funnel"
      headerTight
      description={
        <Text size="sm" tone="muted">
          Repost acknowledgements and blocked download attempts across mixes with gates enabled.
        </Text>
      }
    >
      <Text size="sm" className="studio-mb-md">
        <strong>{summary.artistFollowerCount}</strong> channel followers ·{' '}
        <strong>{summary.totals.repostAcks}</strong> repost acks ·{' '}
        <strong>{summary.totals.blockedAttempts}</strong> blocked attempts
        {summary.totals.countedDownloads != null && (
          <>
            {' '}
            · <strong>{summary.totals.countedDownloads}</strong> counted downloads (14d)
          </>
        )}
      </Text>
      {summary.daily && summary.daily.length > 0 && <GateDailyChart daily={summary.daily} />}
      <table className="studio-table">
        <thead>
          <tr>
            <th>Mix</th>
            <th>Gates</th>
            <th>Reposts</th>
            <th>Blocked</th>
            <th>Counted</th>
          </tr>
        </thead>
        <tbody>
          {summary.items.map((row) => (
            <tr key={row.archiveItemId}>
              <td>{row.title}</td>
              <td className="studio-text-muted-sm">
                {[row.repostToDownload ? 'repost' : null, row.followToDownload ? 'follow' : null]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </td>
              <td>{row.repostAckCount}</td>
              <td>{row.blockedDownloadAttempts}</td>
              <td>{row.countedDownloadCount ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}

function GateDailyChart({ daily }: { daily: GateDailyPoint[] }) {
  const max = Math.max(
    1,
    ...daily.flatMap((d) => [d.repostAcks, d.blockedAttempts, d.countedDownloads]),
  )

  return (
    <div className="studio-mb-lg">
      <Text size="sm" tone="muted" className="studio-mb-sm">
        Last 14 days (UTC)
      </Text>
      <div
        role="img"
        aria-label="Download gate activity chart"
        className="studio-chart studio-chart--tall"
      >
        {daily.map((d) => {
          const total = d.repostAcks + d.blockedAttempts + d.countedDownloads
          const h = Math.round((total / max) * 100)
          const minH = total > 0 ? 6 : 2
          const barPct = Math.max(h, total > 0 ? 8 : 2)
          return (
            <div key={d.date} className="studio-chart-col">
              <div
                title={`${d.date}: ${d.repostAcks} reposts, ${d.blockedAttempts} blocked, ${d.countedDownloads} counted`}
                className="studio-chart-bar studio-chart-bar--gate studio-w-full"
                style={{
                  ['--studio-bar-pct' as string]: `${barPct}%`,
                  ['--studio-bar-min' as string]: `${minH}px`,
                }}
              />
              <span className="studio-chart-label">{d.date.slice(5)}</span>
            </div>
          )
        })}
      </div>
      <Text size="sm" tone="muted">
        Bar height = repost acks + blocked + counted downloads that day
      </Text>
    </div>
  )
}
