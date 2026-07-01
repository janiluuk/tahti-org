// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { ButtonIcon } from '@tahti/ui'
import { Panel } from '@/components/ui'
import { updateChannelSchedule } from './channel-schedule-actions'

export default function ChannelSchedulePanel({
  initialAt,
  initialNote,
  isLive = false,
}: {
  initialAt: string | null
  initialNote: string | null
  isLive?: boolean
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

  const previewAtIso = at ? new Date(at).toISOString() : null
  const previewNote = note.trim() || null

  const previewLabel = [
    previewNote,
    previewAtIso
      ? new Date(previewAtIso).toLocaleString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Panel
      title="Next broadcast"
      headerTight
      description="What listeners see when you're offline."
      className="studio-mt-lg"
    >
      <div className="studio-schedule-row">
        <label className="studio-schedule-row__field">
          <span className="studio-label-sm">Date &amp; time</span>
          <input
            type="datetime-local"
            value={at}
            onChange={(e) => setAt(e.target.value)}
            disabled={isPending}
            className="studio-input"
          />
        </label>
        <label className="studio-schedule-row__field studio-flex-1">
          <span className="studio-label-sm">Note</span>
          <input
            type="text"
            value={note}
            placeholder="e.g. Weekly — Thursdays 22:00 EET"
            onChange={(e) => setNote(e.target.value)}
            disabled={isPending}
            className="studio-input"
          />
        </label>
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="ui-btn ui-btn--primary"
        >
          <ButtonIcon name="save" />
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={isPending}
          className="ui-btn ui-btn--ghost ui-btn--sm"
        >
          Clear
        </button>
      </div>
      {error && <p className="studio-text-error studio-mt-xs">{error}</p>}
      {!isLive && previewLabel && (
        <p className="studio-text-muted-sm studio-mt-sm" aria-live="polite">
          Listener preview: {previewLabel}
        </p>
      )}
    </Panel>
  )
}
