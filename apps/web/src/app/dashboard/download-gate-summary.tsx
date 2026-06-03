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
    totals: { repostAcks: number; blockedAttempts: number }
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
      <Text size="sm" style={{ marginBottom: '0.75rem' }}>
        <strong>{summary.artistFollowerCount}</strong> channel followers ·{' '}
        <strong>{summary.totals.repostAcks}</strong> repost acks ·{' '}
        <strong>{summary.totals.blockedAttempts}</strong> blocked attempts
      </Text>
      {summary.daily && summary.daily.length > 0 && (
        <GateDailyChart daily={summary.daily} />
      )}
      <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #eee' }}>
            <th style={{ padding: '0.35rem 0' }}>Mix</th>
            <th>Gates</th>
            <th>Reposts</th>
            <th>Blocked</th>
          </tr>
        </thead>
        <tbody>
          {summary.items.map((row) => (
            <tr key={row.archiveItemId} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '0.4rem 0' }}>{row.title}</td>
              <td style={{ color: '#666' }}>
                {[row.repostToDownload ? 'repost' : null, row.followToDownload ? 'follow' : null]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </td>
              <td>{row.repostAckCount}</td>
              <td>{row.blockedDownloadAttempts}</td>
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
    <div style={{ marginBottom: '1rem' }}>
      <Text size="sm" tone="muted" style={{ marginBottom: '0.35rem' }}>
        Last 14 days (UTC)
      </Text>
      <div
        role="img"
        aria-label="Download gate activity chart"
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 4,
          height: 72,
          padding: '0.25rem 0',
        }}
      >
        {daily.map((d) => {
          const total = d.repostAcks + d.blockedAttempts + d.countedDownloads
          const h = Math.round((total / max) * 100)
          return (
            <div
              key={d.date}
              title={`${d.date}: ${d.repostAcks} reposts, ${d.blockedAttempts} blocked, ${d.countedDownloads} counted`}
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: `${Math.max(h, total > 0 ? 8 : 2)}%`,
                  minHeight: total > 0 ? 6 : 2,
                  background: '#2563eb',
                  borderRadius: 2,
                }}
              />
              <span style={{ fontSize: '0.6rem', color: '#999', transform: 'rotate(-45deg)' }}>
                {d.date.slice(5)}
              </span>
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
