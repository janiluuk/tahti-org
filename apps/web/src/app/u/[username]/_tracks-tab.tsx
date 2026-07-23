// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AddToPlaylistButton } from '../../dashboard/_add-to-playlist-button'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_BASE ?? ''

export interface TrackTabItem {
  id: string
  title: string
  durationSec: number | null
  bannerUrl: string | null
  playUrl: string | null
  pinned: boolean
  pinnedAt: string | null
  trackOrder: number
  createdAt: string
  channelItemUrl: string | null
}

type SortMode = 'time' | 'name' | 'manual'

function formatDuration(sec: number | null): string {
  if (sec == null) return ''
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function sortTracks(tracks: TrackTabItem[], mode: SortMode): TrackTabItem[] {
  if (mode === 'name') return [...tracks].sort((a, b) => a.title.localeCompare(b.title))
  if (mode === 'time') {
    return [...tracks].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  return [...tracks].sort((a, b) => a.trackOrder - b.trackOrder)
}

export function TracksTab({ tracks, isOwner }: { tracks: TrackTabItem[]; isOwner: boolean }) {
  const [mode, setMode] = useState<SortMode>('time')
  const [order, setOrder] = useState<TrackTabItem[]>(() => sortTracks(tracks, 'time'))
  const [saving, setSaving] = useState(false)

  const visible = useMemo(
    () => (mode === 'manual' ? order : sortTracks(tracks, mode)),
    [mode, order, tracks],
  )

  function changeMode(next: SortMode) {
    setMode(next)
    if (next === 'manual') setOrder(sortTracks(tracks, 'manual'))
  }

  function persistOrder(next: TrackTabItem[]) {
    setOrder(next)
    setSaving(true)
    fetch(`${API_BASE}/api/me/archive/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ids: next.map((t) => t.id) }),
    })
      .catch(() => {})
      .finally(() => setSaving(false))
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= visible.length) return
    const next = [...visible]
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    persistOrder(next)
  }

  if (tracks.length === 0) {
    return (
      <div className="public-empty-card">
        <p className="public-empty-card__text">No tracks yet.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="prof-sec-label-row">
        <div className="prof-sec-label">Tracks</div>
        <div className="prof-sec-label-row__actions">
          <div className="prof-sec-count">{tracks.length} total</div>
        </div>
      </div>
      <div className="prof-tracks-sort" role="group" aria-label="Sort tracks">
        {(['time', 'name', 'manual'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => changeMode(key)}
            className={`prof-tracks-sort__btn${mode === key ? ' prof-tracks-sort__btn--active' : ''}`}
          >
            {key === 'time' ? 'Newest' : key === 'name' ? 'Name' : 'Manual'}
          </button>
        ))}
        {mode === 'manual' && saving && (
          <span className="prof-list-meta prof-list-meta--tight">Saving…</span>
        )}
      </div>

      <ul className="prof-list prof-collection-list">
        {visible.map((t, i) => (
          <li key={t.id}>
            <div className="prof-collection-row">
              <div className="prof-collection-cover">
                {t.bannerUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.bannerUrl} alt="" width={76} height={76} />
                ) : (
                  <span className="prof-collection-cover-ph" aria-hidden />
                )}
              </div>
              <div>
                {t.channelItemUrl ? (
                  <Link href={t.channelItemUrl} className="prof-collection-title">
                    {t.title}
                  </Link>
                ) : (
                  <div className="prof-collection-title">{t.title}</div>
                )}
                <div className="prof-list-meta prof-list-meta--strong">
                  {formatDuration(t.durationSec)}
                  {t.pinned && ' · Pinned'}
                </div>
              </div>
              {isOwner && (
                <div className="prof-tracks-owner-actions">
                  <Link href="/dashboard/archive" className="ui-btn ui-btn--sm ui-btn--ghost">
                    Edit
                  </Link>
                  <AddToPlaylistButton archiveItemId={t.id} />
                  {mode === 'manual' && (
                    <div className="prof-tracks-reorder">
                      <button
                        type="button"
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        aria-label={`Move ${t.title} up`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={i === visible.length - 1}
                        aria-label={`Move ${t.title} down`}
                      >
                        ↓
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
