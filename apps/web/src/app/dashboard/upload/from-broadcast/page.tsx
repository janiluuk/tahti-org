// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { fetchRecentBroadcasts } from '../upload-actions'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function statusLabel(b: { archiveItemId: string | null; archiveItemStatus?: string }): {
  text: string
  cls: string
} {
  if (!b.archiveItemId) return { text: 'Unprocessed', cls: 'broadcast-row__status--pending' }
  if (b.archiveItemStatus === 'READY') return { text: 'Ready', cls: 'broadcast-row__status--ready' }
  if (b.archiveItemStatus === 'PROCESSING')
    return { text: 'Processing', cls: 'broadcast-row__status--processing' }
  return { text: b.archiveItemStatus ?? 'Pending', cls: 'broadcast-row__status--pending' }
}

export default async function FromBroadcastPage() {
  const broadcasts = await fetchRecentBroadcasts(50)

  return (
    <div className="from-broadcast-page">
      <div className="from-broadcast-page__header">
        <Link href="/dashboard/upload" className="collection-editor__back">
          ← Add content
        </Link>
        <h1 className="from-broadcast-page__title">Publish from broadcast</h1>
      </div>

      {broadcasts.length === 0 ? (
        <div className="collections-empty">
          <h2 className="collections-empty__heading">No broadcasts yet</h2>
          <p className="collections-empty__body">
            Go live from the dashboard to create a broadcast recording you can publish here.
          </p>
          <Link href="/dashboard" className="studio-btn-primary">
            Go to live dashboard
          </Link>
        </div>
      ) : (
        <ol className="from-broadcast-page__list">
          {broadcasts.map((b) => {
            const { text, cls } = statusLabel(b)
            const href = b.archiveItemId
              ? `/dashboard/archive/${b.archiveItemId}/editor`
              : `/dashboard/upload/from-broadcast?id=${b.id}`
            const label = b.archiveItemId
              ? b.archiveItemStatus === 'READY'
                ? 'Polish & publish →'
                : 'View progress →'
              : 'Edit & publish →'
            return (
              <li key={b.id} className="broadcast-row">
                <div className="broadcast-row__info">
                  <span className="broadcast-row__name">
                    {b.archiveItemTitle ?? `Broadcast ${formatDate(b.startedAt)}`}
                  </span>
                  <span className="broadcast-row__meta">
                    {formatDate(b.startedAt)}
                    {b.durationSec ? ` · ${formatDuration(b.durationSec)}` : ''}
                  </span>
                </div>
                <span className={`broadcast-row__status ${cls}`}>{text}</span>
                <Link href={href} className="studio-btn-ghost studio-btn-sm">
                  {label}
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
