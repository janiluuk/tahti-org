// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { Panel } from '@/components/ui'
import { updateChannelSchedule } from './channel-schedule-actions'

export default function ChannelSchedulePanel({
  initialAt,
  initialNote,
}: {
  initialAt: string | null
  initialNote: string | null
}) {
  const [at, setAt] = useState(initialAt ? new Date(initialAt).toISOString().slice(0, 16) : '')
  const [note, setNote] = useState(initialNote ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function save() {
    setError(null)
    startTransition(async () => {
      const res = await updateChannelSchedule({
        nextBroadcastAt: at ? new Date(at).toISOString() : null,
        nextBroadcastNote: note.trim() || null,
      })
      if (res.error) setError(res.error)
    })
  }

  function clear() {
    setAt('')
    setNote('')
    startTransition(async () => {
      const res = await updateChannelSchedule({
        nextBroadcastAt: null,
        nextBroadcastNote: null,
      })
      if (res.error) setError(res.error)
    })
  }

  return (
    <Panel title="Next broadcast" style={{ marginTop: '1.5rem' }}>
      <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.75rem' }}>
        When you are offline, listeners see when you plan to go live next.
      </p>
      <label style={{ display: 'block', marginBottom: '0.5rem' }}>
        Date & time (local)
        <input
          type="datetime-local"
          value={at}
          onChange={(e) => setAt(e.target.value)}
          disabled={isPending}
          style={{ display: 'block', width: '100%', marginTop: 2 }}
        />
      </label>
      <label style={{ display: 'block', marginBottom: '0.75rem' }}>
        Short note
        <input
          type="text"
          value={note}
          placeholder="e.g. Weekly — Thursdays 22:00 EET"
          onChange={(e) => setNote(e.target.value)}
          disabled={isPending}
          style={{ display: 'block', width: '100%', marginTop: 2 }}
        />
      </label>
      {error && <p style={{ color: '#b91c1c', fontSize: '0.9rem' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" onClick={save} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save schedule'}
        </button>
        <button type="button" onClick={clear} disabled={isPending}>
          Clear
        </button>
      </div>
    </Panel>
  )
}
