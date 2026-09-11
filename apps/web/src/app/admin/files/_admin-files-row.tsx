'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState, type CSSProperties, type MouseEvent } from 'react'
import Link from 'next/link'
import type { AdminFileRow } from '@tahti/shared'
import { Alert } from '@tahti/ui'
import { usePlayer, type PlayerTrack } from '@/contexts/player-context'
import { API_BASE } from './_admin-files-types'

function fmtDuration(sec: number | null) {
  if (sec == null || sec <= 0) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function genreLabel(row: AdminFileRow) {
  return row.genreCustom || row.genre || '—'
}

export function FileRow({
  row,
  selected,
  onToggle,
  onEdit,
  onDeleted,
}: {
  row: AdminFileRow
  selected: boolean
  onToggle: () => void
  onEdit: () => void
  onDeleted: () => void
}) {
  const { track, playing, currentTime, duration, load, togglePlay, seek } = usePlayer()
  const isCurrent = track?.id === row.id
  const progress = isCurrent && duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function playPreview(e: MouseEvent) {
    e.stopPropagation()
    if (isCurrent) {
      void togglePlay()
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/files/${row.id}/audio`, {
        credentials: 'include',
      })
      if (!res.ok) return
      const data = (await res.json()) as {
        audioUrl: string | null
        title: string
        artistName: string
        channelSlug: string
        bannerUrl: string | null
      }
      if (!data.audioUrl) return

      const playerTrack: PlayerTrack = {
        id: row.id,
        kind: 'sound',
        url: data.audioUrl,
        title: data.title,
        subtitle: data.artistName,
        href: `/admin/channels/${data.channelSlug}/archive`,
        artworkUrl: data.bannerUrl,
      }
      load(playerTrack, { autoplay: true, queue: [playerTrack] })
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(e: MouseEvent) {
    e.stopPropagation()
    if (!window.confirm(`Delete “${row.title}”? This cannot be undone.`)) return
    setBusy(true)
    try {
      const res = await fetch(`${API_BASE}/api/admin/files/${row.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok || res.status === 204) onDeleted()
      else {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? 'Delete failed')
      }
    } finally {
      setBusy(false)
    }
  }

  function handleRowSeek(e: MouseEvent<HTMLDivElement>) {
    if (!isCurrent || duration <= 0) return
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, label')) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    seek(ratio)
  }

  return (
    <div
      className={`admin-files-row${isCurrent ? ' admin-files-row--active' : ''}${
        playing && isCurrent ? ' admin-files-row--playing' : ''
      }`}
      style={
        isCurrent
          ? ({ '--admin-files-progress': `${progress * 100}%` } as CSSProperties)
          : undefined
      }
      onClick={handleRowSeek}
      role={isCurrent ? 'slider' : undefined}
      aria-valuemin={isCurrent ? 0 : undefined}
      aria-valuemax={isCurrent ? 100 : undefined}
      aria-valuenow={isCurrent ? Math.round(progress * 100) : undefined}
      aria-label={isCurrent ? `Seek ${row.title}` : undefined}
    >
      {error && <Alert variant="error">{error}</Alert>}
      <label className="admin-files-row__check" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label="Select file" />
      </label>
      <div className="admin-files-row__main">
        <span className="admin-files-row__title">{row.title}</span>
        <span className="admin-files-row__meta">
          {row.artistName}
          <span aria-hidden> · </span>@{row.username}
          <span aria-hidden> · </span>
          {genreLabel(row)}
          <span aria-hidden> · </span>
          {row.contentType.replace(/_/g, ' ')}
          <span aria-hidden> · </span>
          {fmtDuration(row.durationSec)}
          {!row.isPublic && <span className="admin-files-row__badge">private</span>}
          {row.status !== 'READY' && <span className="admin-files-row__badge">{row.status}</span>}
        </span>
      </div>
      <div className="admin-files-row__actions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="ui-btn ui-btn--sm ui-btn--ghost"
          onClick={playPreview}
          disabled={busy}
          aria-label={isCurrent && playing ? 'Pause' : 'Preview'}
        >
          {isCurrent && playing ? 'Pause' : 'Preview'}
        </button>
        <button
          type="button"
          className="ui-btn ui-btn--sm ui-btn--ghost"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
        >
          Edit
        </button>
        <Link
          href={`/admin/channels/${row.channelSlug}/archive`}
          className="ui-btn ui-btn--sm ui-btn--ghost"
        >
          Channel
        </Link>
        <button
          type="button"
          className="ui-btn ui-btn--sm ui-btn--ghost admin-files-row__danger"
          onClick={handleDelete}
          disabled={busy}
        >
          Delete
        </button>
      </div>
    </div>
  )
}
