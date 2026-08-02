// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import { Button, Panel } from '@tahti/ui'
import { RADIO_SUBMISSION_MAX_TRACKS } from '@tahti/shared'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

type ArchiveRow = {
  id: string
  title: string
  status: string
  durationSec: number | null
}

type SubmissionRow = {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  archiveItem: { id: string; title: string }
  rejectionNote: string | null
  createdAt: string
}

function fmtDuration(sec: number | null) {
  if (sec == null) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function RadioSubmitPanel() {
  const [tracks, setTracks] = useState<ArchiveRow[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  async function refresh() {
    const [archiveRes, subRes] = await Promise.all([
      fetch(`${API_BASE}/api/me/archive`, { credentials: 'include' }),
      fetch(`${API_BASE}/api/me/radio-submissions`, { credentials: 'include' }),
    ])
    if (archiveRes.ok) {
      const data = (await archiveRes.json()) as ArchiveRow[]
      setTracks(data.filter((t) => t.status === 'READY'))
    }
    if (subRes.ok) {
      const data = (await subRes.json()) as { items: SubmissionRow[] }
      setSubmissions(data.items)
    }
    setLoaded(true)
  }

  useEffect(() => {
    void refresh()
  }, [])

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= RADIO_SUBMISSION_MAX_TRACKS) return prev
      return [...prev, id]
    })
  }

  async function submit() {
    if (selected.length === 0) return
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      const res = await fetch(`${API_BASE}/api/me/radio-submissions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archiveItemIds: selected,
          note: note.trim() || undefined,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Submit failed')
        return
      }
      setSelected([])
      setNote('')
      setMsg(
        `Submitted ${selected.length} track${selected.length === 1 ? '' : 's'} for Tahti Radio review.`,
      )
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) return null

  const pendingIds = new Set(
    submissions.filter((s) => s.status === 'PENDING').map((s) => s.archiveItem.id),
  )

  return (
    <Panel title="Submit to Tahti Radio" headerTight data-testid="radio-submit-panel">
      <p className="studio-text-muted-sm">
        Pick up to {RADIO_SUBMISSION_MAX_TRACKS} ready tracks from your library. The board audits
        each one before it joins the public Tahti Radio rotation.
      </p>

      {tracks.length === 0 ? (
        <p className="studio-text-muted-sm studio-mt-sm">
          No ready tracks yet — upload something in Music first.
        </p>
      ) : (
        <ul className="studio-list studio-mt-md">
          {tracks.map((t) => {
            const checked = selected.includes(t.id)
            const awaiting = pendingIds.has(t.id)
            const disabled =
              awaiting || (!checked && selected.length >= RADIO_SUBMISSION_MAX_TRACKS)
            return (
              <li key={t.id} className="studio-programme-row">
                <label className="studio-toggle-row">
                  <input
                    type="checkbox"
                    className="studio-toggle-checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(t.id)}
                  />
                  <span className="studio-toggle-label">
                    {t.title}
                    {t.durationSec != null ? (
                      <span className="studio-text-muted-sm"> {fmtDuration(t.durationSec)}</span>
                    ) : null}
                    {awaiting ? (
                      <span className="studio-text-muted-sm"> · awaiting review</span>
                    ) : null}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}

      <label className="studio-field studio-mt-md">
        <span className="studio-text-muted-sm">Note to the board (optional)</span>
        <textarea
          className="studio-textarea"
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything the reviewers should know"
        />
      </label>

      <div className="studio-mt-md">
        <Button
          type="button"
          variant="primary"
          disabled={busy || selected.length === 0}
          onClick={() => void submit()}
        >
          {busy
            ? 'Submitting…'
            : `Submit ${selected.length || ''} track${selected.length === 1 ? '' : 's'}`.trim()}
        </Button>
        <span className="studio-text-muted-sm studio-ml-sm">
          {selected.length}/{RADIO_SUBMISSION_MAX_TRACKS} selected
        </span>
      </div>

      {msg ? <p className="studio-text-muted-sm studio-mt-sm">{msg}</p> : null}
      {error ? <p className="studio-text-error studio-mt-sm">{error}</p> : null}

      {submissions.length > 0 ? (
        <div className="studio-mt-lg">
          <h3 className="ui-heading ui-heading--3">Recent submissions</h3>
          <ul className="studio-list studio-mt-sm">
            {submissions.slice(0, 12).map((s) => (
              <li key={s.id} className="studio-programme-row">
                <span className="studio-programme-label">
                  {s.archiveItem.title}
                  <span className="studio-text-muted-sm"> · {s.status.toLowerCase()}</span>
                </span>
                {s.status === 'REJECTED' && s.rejectionNote ? (
                  <span className="studio-text-muted-sm">{s.rejectionNote}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  )
}
