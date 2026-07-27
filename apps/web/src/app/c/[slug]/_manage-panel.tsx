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

/** Owner/board-only tab on the channel page — live stats snapshot, refreshed
 * periodically while the tab is open. Playlist switching, transport controls,
 * multistream status, and editable external metadata land in follow-up passes. */
export function ManagePanel({ slug, initialStats }: { slug: string; initialStats: ManageStats }) {
  const [stats, setStats] = useState(initialStats)

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
    </section>
  )
}
