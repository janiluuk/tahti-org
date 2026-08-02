'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
import { updateAutoRecordEnabled } from './recording-actions'

/** Moderately large Record control for pre-live. Persists `autoRecordEnabled`
 *  (last-used channel setting) so the next session starts with the same choice. */
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
    <div className="broadcast-studio__record">
      <button
        type="button"
        className={`broadcast-studio__record-btn${enabled ? ' is-armed' : ''}`}
        aria-pressed={enabled}
        disabled={pending}
        onClick={() => void onToggle()}
      >
        <span className="broadcast-studio__record-btn__dot" aria-hidden />
        <span className="broadcast-studio__record-btn__label">
          {enabled ? 'Recording' : 'Record'}
        </span>
      </button>
      <p className="broadcast-studio__record-hint">
        {enabled
          ? 'This show will be saved to your archive after you go live (same setting as last time).'
          : 'Arm recording to archive this show after you go live. Remembers your last choice.'}
      </p>
      {error && <p className="studio-notice studio-notice--error studio-mt-xs">{error}</p>}
    </div>
  )
}
