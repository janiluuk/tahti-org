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

export function DownloadGateSummaryPanel({
  summary,
}: {
  summary: {
    artistFollowerCount: number
    totals: { repostAcks: number; blockedAttempts: number }
    items: GateSummaryItem[]
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
