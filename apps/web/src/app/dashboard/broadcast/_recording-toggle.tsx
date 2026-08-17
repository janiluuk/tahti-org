'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
import { updateAutoRecordEnabled } from './recording-actions'

export function RecordingToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setEnabled(initialEnabled)
  }, [initialEnabled])

  async function onToggle() {
    const next = !enabled
    setEnabled(next)
    setPending(true)
    setError(null)
    const res = await updateAutoRecordEnabled(next)
    if (res.error) {
      setEnabled(!next)
      setError(res.error)
    }
    setPending(false)
  }

  return (
    <div className="broadcast-studio__toggle-control">
      <span className="broadcast-studio__toggle-label">Record show</span>
      <button
        type="button"
        className={`broadcast-studio__red-toggle${enabled ? ' is-active' : ''}`}
        aria-pressed={enabled}
        aria-label={enabled ? 'Disable recording' : 'Enable recording'}
        disabled={pending}
        onClick={() => void onToggle()}
      >
        <span aria-hidden />
      </button>
      {error && <p className="studio-notice studio-notice--error studio-mt-xs">{error}</p>}
    </div>
  )
}
