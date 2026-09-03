// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@tahti/ui'
import { usePlayer, type PlayerTrack } from '@/contexts/player-context'
import { approveRadioSubmission, rejectRadioSubmission } from './actions'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

export type RadioSubmissionRow = {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  positionInBatch: number
  rejectionNote: string | null
  reviewedAt?: string | null
  createdAt: string
  batchId?: string
  batchNote?: string | null
  submitter?: { id: string; username: string; displayName: string }
  sound: {
    id: string
    title: string
    artistName: string | null
    durationSec: number | null
    bannerUrl: string | null
  }
}

function fmtDuration(sec: number | null) {
  if (sec == null) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function RadioSubmissionsPanel({ items }: { items: RadioSubmissionRow[] }) {
  const router = useRouter()
  const { track, playing, currentTime, duration, load, togglePlay, seek } = usePlayer()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const active = items.find((i) => i.id === activeId) ?? items[0] ?? null
  const isPlayingActive = active != null && track?.id === `radio-sub-${active.sound.id}` && playing

  async function playItem(row: RadioSubmissionRow) {
    setActiveId(row.id)
    setLoadingId(row.id)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/admin/radio-submissions/${row.id}/audio`, {
        credentials: 'include',
      })
      if (!res.ok) {
        setError('Could not load audio')
        return
      }
      const data = (await res.json()) as {
        audioUrl: string
        title: string
        artistName: string
      }
      const playerTrack: PlayerTrack = {
        id: `radio-sub-${row.sound.id}`,
        kind: 'sound',
        title: data.title,
        subtitle: data.artistName,
        url: data.audioUrl,
        artworkUrl: row.sound.bannerUrl,
      }
      load(playerTrack, { autoplay: true, queue: [playerTrack] })
    } finally {
      setLoadingId(null)
    }
  }

  async function onApprove(id: string) {
    setPendingId(id)
    setError(null)
    const res = await approveRadioSubmission(id)
    setPendingId(null)
    if (res.error) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  async function onReject(id: string) {
    setPendingId(id)
    setError(null)
    const res = await rejectRadioSubmission(id, notes[id])
    setPendingId(null)
    if (res.error) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  if (items.length === 0) {
    return <p className="admin-text-muted">No unaudited radio submissions.</p>
  }

  return (
    <div className="admin-radio-audit">
      {active && (
        <section className="admin-radio-audit__player" aria-label="Submission player">
          <div className="admin-radio-audit__meta">
            <p className="admin-radio-audit__eyebrow">Auditing</p>
            <h2 className="admin-radio-audit__title">{active.sound.title}</h2>
            <p className="admin-text-muted">
              {active.sound.artistName ?? active.submitter?.displayName ?? 'Unknown artist'}
              {' · '}
              {fmtDuration(active.sound.durationSec)}
              {active.submitter ? (
                <>
                  {' · '}
                  <a href={`/u/${active.submitter.username}`} className="admin-link">
                    @{active.submitter.username}
                  </a>
                </>
              ) : null}
            </p>
            {active.batchNote ? (
              <p className="admin-radio-audit__note">Artist note: {active.batchNote}</p>
            ) : null}
          </div>

          <div className="admin-radio-audit__transport">
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                if (track?.id === `radio-sub-${active.sound.id}`) {
                  void togglePlay()
                } else {
                  void playItem(active)
                }
              }}
              disabled={loadingId === active.id}
            >
              {loadingId === active.id ? 'Loading…' : isPlayingActive ? 'Pause' : 'Play'}
            </Button>
            <div className="admin-radio-audit__scrub">
              <span className="admin-text-muted">{fmtTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.001}
                value={
                  track?.id === `radio-sub-${active.sound.id}` && duration > 0
                    ? currentTime / duration
                    : 0
                }
                onChange={(e) => seek(Number(e.target.value))}
                aria-label="Seek"
              />
              <span className="admin-text-muted">
                {fmtTime(duration || active.sound.durationSec || 0)}
              </span>
            </div>
          </div>

          <div className="admin-beta-approve-form admin-radio-audit__actions">
            <textarea
              placeholder="Rejection note (optional — artist is notified only if you enter text)"
              value={notes[active.id] ?? ''}
              onChange={(e) => setNotes((prev) => ({ ...prev, [active.id]: e.target.value }))}
              rows={3}
            />
            <div className="admin-beta-action-row">
              <Button
                type="button"
                variant="primary"
                disabled={pendingId === active.id || active.status !== 'PENDING'}
                onClick={() => void onApprove(active.id)}
              >
                {pendingId === active.id ? 'Saving…' : 'Approve to radio'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pendingId === active.id || active.status === 'REJECTED'}
                onClick={() => void onReject(active.id)}
              >
                Reject from radio
              </Button>
            </div>
          </div>
        </section>
      )}

      {error ? <p className="admin-form-error">{error}</p> : null}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Submitted</th>
              <th>Track</th>
              <th>Artist</th>
              <th>Duration</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr
                key={row.id}
                className={row.id === active?.id ? 'admin-radio-audit__row--active' : undefined}
              >
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>{row.sound.title}</td>
                <td>
                  {row.submitter ? (
                    <a href={`/u/${row.submitter.username}`} className="admin-link">
                      {row.submitter.displayName}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{fmtDuration(row.sound.durationSec)}</td>
                <td className={row.status === 'PENDING' ? 'admin-warn' : ''}>{row.status}</td>
                <td>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void playItem(row)}
                  >
                    Audit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
