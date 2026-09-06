'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
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
  /** `time` matches system-log density; default is a full datetime for audit rows. */
  timestampStyle?: 'datetime' | 'time'
  /** Called when `live` is on and the user scrolls away from the tail. */
  onFollowPause?: () => void
}

export function previewLogLine(line: string, max = 88): string {
  const trimmed = line.replace(/\s+/g, ' ').trim()
  if (!trimmed) return 'Empty line'
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max).trimEnd()}…`
}

function formatTimestamp(
  timestamp: Date | string | number,
  style: 'datetime' | 'time',
): { iso: string; label: string } {
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
    label: date.toLocaleString(
      'fi-FI',
      style === 'time'
        ? { hour: '2-digit', minute: '2-digit', second: '2-digit' }
        : {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          },
    ),
  }
}

function copyText(entry: LogViewerEntry): string {
  return entry.detail ? `${entry.title}\n${entry.detail}` : entry.title
}

export function LogViewer({
  entries,
  loading = false,
  emptyMessage = 'No log entries match the current filters.',
  live = false,
  footer,
  timestampStyle = 'datetime',
  onFollowPause,
  className,
  ...props
}: LogViewerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const ignoreProgrammaticScroll = useRef(false)
  const onFollowPauseRef = useRef(onFollowPause)
  onFollowPauseRef.current = onFollowPause

  useEffect(() => {
    if (!live) return
    const viewer = viewerRef.current
    if (!viewer) return
    ignoreProgrammaticScroll.current = true
    viewer.scrollTop = viewer.scrollHeight
    requestAnimationFrame(() => {
      ignoreProgrammaticScroll.current = false
    })
  }, [live, entries])

  async function copyLine(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500)
    } catch {
      setCopiedId(null)
    }
  }

  return (
    <div className={cn('ui-log-viewer-wrap', className)} {...props}>
      <div
        ref={viewerRef}
        className="ui-log-viewer"
        aria-live={live ? 'polite' : undefined}
        onScroll={(event) => {
          if (!live || ignoreProgrammaticScroll.current) return
          const viewer = event.currentTarget
          if (viewer.scrollTop + viewer.clientHeight < viewer.scrollHeight - 24) {
            onFollowPauseRef.current?.()
          }
        }}
      >
        {entries.length === 0 && !loading ? (
          <p className="ui-log-viewer__empty">{emptyMessage}</p>
        ) : (
          entries.map((entry) => {
            const time = formatTimestamp(entry.timestamp, timestampStyle)
            const open = expandedId === entry.id
            const hasTitle = Boolean(entry.title.trim())
            return (
              <article key={entry.id} className={cn('ui-log-line', open && 'ui-log-line--open')}>
                <button
                  type="button"
                  className="ui-log-line__summary"
                  aria-expanded={open}
                  onClick={() => setExpandedId(open ? null : entry.id)}
                >
                  {time.iso ? (
                    <time dateTime={time.iso}>{time.label}</time>
                  ) : (
                    <span>{time.label}</span>
                  )}
                  <strong>{entry.source}</strong>
                  <span className="ui-log-line__preview">{previewLogLine(entry.title)}</span>
                </button>
                <div className="ui-log-line__detail">
                  {hasTitle ? (
                    <code>{entry.title}</code>
                  ) : (
                    <p className="ui-log-line__empty-msg">This entry has no message text.</p>
                  )}
                  {entry.detail ? <pre>{entry.detail}</pre> : null}
                  <button
                    type="button"
                    className="ui-log-line__copy"
                    onClick={() => void copyLine(entry.id, copyText(entry))}
                  >
                    {copiedId === entry.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </article>
            )
          })
        )}
      </div>
      {footer}
    </div>
  )
}
