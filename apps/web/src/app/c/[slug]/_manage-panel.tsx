'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'

export interface ManageStats {
  audioBitrateKbps: number | null
  listeners: number
  listenerPeak: number
  plays: number
  likes: number
  reposts: number
  liveDurationSec: number | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const REFRESH_MS = 15_000

function formatDuration(sec: number | null): string {
  if (sec == null) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

type TransportAction = 'skip' | 'previous' | 'pause' | 'resume'

const TRANSPORT_BUTTONS: Array<{ action: TransportAction; label: string; icon: JSX.Element }> = [
  {
    action: 'previous',
    label: 'Play previous track',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M6 6h2v12H6zm3.5 6 9-6v12z" fill="currentColor" />
      </svg>
    ),
  },
  {
    action: 'pause',
    label: 'Stop rotation (live broadcasts are unaffected)',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M6 5h4v14H6zm8 0h4v14h-4z" fill="currentColor" />
      </svg>
    ),
  },
  {
    action: 'resume',
    label: 'Resume rotation',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M8 5v14l11-7z" fill="currentColor" />
      </svg>
    ),
  },
  {
    action: 'skip',
    label: 'Play next track',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M16 6h2v12h-2zM5.5 6l9 6-9 6z" fill="currentColor" />
      </svg>
    ),
  },
]

/** Owner/board-only tab on the channel page — live stats snapshot, refreshed
 * periodically while the tab is open, plus transport controls for the archive
 * rotation. Playlist switching, multistream status, and editable external
 * metadata land in follow-up passes. */
export function ManagePanel({ slug, initialStats }: { slug: string; initialStats: ManageStats }) {
  const [stats, setStats] = useState(initialStats)
  const [pendingAction, setPendingAction] = useState<TransportAction | null>(null)
  const [transportError, setTransportError] = useState<string | null>(null)

  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch(`${API_URL}/api/channels/${slug}/manage-stats`, {
          credentials: 'include',
        })
        if (res.ok) setStats((await res.json()) as ManageStats)
      } catch {
        // keep showing the last-known values
      }
    }
    const id = setInterval(tick, REFRESH_MS)
    return () => clearInterval(id)
  }, [slug])

  const runTransportAction = async (action: TransportAction) => {
    setPendingAction(action)
    setTransportError(null)
    try {
      const res = await fetch(`${API_URL}/api/channels/${slug}/${action}`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        setTransportError(
          res.status === 409
            ? 'Channel is not currently running'
            : res.status === 404 && action === 'previous'
              ? 'No previous track available'
              : 'Action failed — try again',
        )
      }
    } catch {
      setTransportError('Action failed — try again')
    } finally {
      setPendingAction(null)
    }
  }

  const rows: Array<{ label: string; value: string }> = [
    {
      label: 'Audio Bitrate',
      value: stats.audioBitrateKbps != null ? `${stats.audioBitrateKbps} kbps` : 'Not live',
    },
    { label: 'Listeners', value: String(stats.listeners) },
    { label: 'Listener Peak', value: String(stats.listenerPeak) },
    { label: 'Plays', value: String(stats.plays) },
    { label: 'Likes', value: String(stats.likes) },
    { label: 'Reposts', value: String(stats.reposts) },
    { label: 'Duration', value: formatDuration(stats.liveDurationSec) },
  ]

  return (
    <section className="ch-manage-panel">
      <h2 className="ch-manage-panel__title">Manage</h2>
      <dl className="ch-manage-stats">
        {rows.map((row) => (
          <div key={row.label} className="ch-manage-stats__cell">
            <dt className="ch-manage-stats__label">{row.label}</dt>
            <dd className="ch-manage-stats__value">{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="ch-manage-transport" role="group" aria-label="Playback controls">
        {TRANSPORT_BUTTONS.map(({ action, label, icon }) => (
          <button
            key={action}
            type="button"
            className="ch-manage-transport__btn"
            title={label}
            aria-label={label}
            disabled={pendingAction !== null}
            onClick={() => void runTransportAction(action)}
          >
            {icon}
          </button>
        ))}
      </div>
      {transportError && <p className="ch-manage-transport__error">{transportError}</p>}
    </section>
  )
}
