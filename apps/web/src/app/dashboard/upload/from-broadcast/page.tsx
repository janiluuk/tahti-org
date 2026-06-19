// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { Panel, SidebarNavIconSvg, Text } from '@tahti/ui'
import { ImportPageLayout, ImportSteps } from '../import/_import-page-layout'
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
  tone: 'ready' | 'processing' | 'pending'
} {
  if (!b.archiveItemId) return { text: 'Unprocessed', tone: 'pending' }
  if (b.archiveItemStatus === 'READY') return { text: 'Ready', tone: 'ready' }
  if (b.archiveItemStatus === 'PROCESSING') return { text: 'Processing', tone: 'processing' }
  return { text: b.archiveItemStatus ?? 'Pending', tone: 'pending' }
}

const HOW_IT_WORKS = [
  'Go live from your dashboard — Tahti records the broadcast',
  'Pick a recording from the list below',
  'Trim, title, and polish in the archive editor',
  'Publish to your channel archive when ready',
]

export default async function FromBroadcastPage() {
  const broadcasts = await fetchRecentBroadcasts(50)

  return (
    <ImportPageLayout
      service="broadcast"
      title="Publish from broadcast"
      description="Turn live broadcast recordings into archive items. Edit the start and end, add a title and artwork, then publish to your channel."
      asideTitle="How it works"
      aside={<ImportSteps steps={HOW_IT_WORKS} />}
    >
      {broadcasts.length === 0 ? (
        <Panel title="No broadcasts yet" className="import-page__panel">
          <Text as="p" tone="muted" className="import-page__panel-copy">
            Go live from the dashboard to create a broadcast recording you can publish here.
          </Text>
          <Link href="/dashboard/broadcast" className="ui-btn ui-btn--primary studio-mt-sm">
            <SidebarNavIconSvg name="distribution" />
            Open broadcast studio
          </Link>
        </Panel>
      ) : (
        <Panel
          title={`Recent broadcasts (${broadcasts.length})`}
          description="Select a recording to edit and publish to your archive."
          className="import-page__panel"
        >
          <ol className="import-page__broadcast-list">
            {broadcasts.map((b) => {
              const { text, tone } = statusLabel(b)
              const href = b.archiveItemId
                ? `/dashboard/archive/${b.archiveItemId}/editor`
                : `/dashboard/upload/from-broadcast?id=${b.id}`
              const label = b.archiveItemId
                ? b.archiveItemStatus === 'READY'
                  ? 'Polish & publish'
                  : 'View progress'
                : 'Edit & publish'
              return (
                <li key={b.id} className="import-page__broadcast-row">
                  <div className="import-page__broadcast-info">
                    <span className="import-page__broadcast-name">
                      {b.archiveItemTitle ?? `Broadcast ${formatDate(b.startedAt)}`}
                    </span>
                    <span className="import-page__broadcast-meta">
                      {formatDate(b.startedAt)}
                      {b.durationSec ? ` · ${formatDuration(b.durationSec)}` : ''}
                    </span>
                  </div>
                  <span
                    className={`import-page__broadcast-status import-page__broadcast-status--${tone}`}
                  >
                    {text}
                  </span>
                  <Link href={href} className="ui-btn ui-btn--ghost ui-btn--sm">
                    {label}
                  </Link>
                </li>
              )
            })}
          </ol>
        </Panel>
      )}
    </ImportPageLayout>
  )
}
