// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn'

export type LogViewerEntry = {
  id: string
  timestamp: Date | string | number
  source: string
  title: string
  detail?: string
}

export interface LogViewerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  entries: readonly LogViewerEntry[]
  loading?: boolean
  emptyMessage?: string
  live?: boolean
  footer?: ReactNode
}

function formatTimestamp(timestamp: Date | string | number): { iso: string; label: string } {
  const date =
    timestamp instanceof Date
      ? timestamp
      : typeof timestamp === 'number'
        ? new Date(timestamp)
        : new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return { iso: '', label: String(timestamp) }
  }
  return {
    iso: date.toISOString(),
    label: date.toLocaleString('fi-FI', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  }
}

export function LogViewer({
  entries,
  loading = false,
  emptyMessage = 'No log entries match the current filters.',
  live = false,
  footer,
  className,
  ...props
}: LogViewerProps) {
  return (
    <div className={cn('ui-log-viewer-wrap', className)} {...props}>
      <div className="ui-log-viewer" aria-live={live ? 'polite' : undefined}>
        {entries.length === 0 && !loading ? (
          <p className="ui-log-viewer__empty">{emptyMessage}</p>
        ) : (
          entries.map((entry) => {
            const time = formatTimestamp(entry.timestamp)
            return (
              <article key={entry.id} className="ui-log-line">
                {time.iso ? (
                  <time dateTime={time.iso}>{time.label}</time>
                ) : (
                  <span>{time.label}</span>
                )}
                <strong>{entry.source}</strong>
                {entry.detail ? (
                  <details>
                    <summary>
                      <code>{entry.title}</code>
                    </summary>
                    <pre>{entry.detail}</pre>
                  </details>
                ) : (
                  <code>{entry.title}</code>
                )}
              </article>
            )
          })
        )}
      </div>
      {footer}
    </div>
  )
}
