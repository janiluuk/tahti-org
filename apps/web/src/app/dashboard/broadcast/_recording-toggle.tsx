'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState } from 'react'
import { updateAutoRecordEnabled } from './recording-actions'

export function RecordingToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onChange(next: boolean) {
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
    <div className="broadcast-studio__recording-toggle">
      <label className="studio-label-row">
        <input
          type="checkbox"
          checked={enabled}
          disabled={pending}
          onChange={(e) => onChange(e.target.checked)}
        />
        Auto-record this broadcast to your archive
      </label>
      {error && <p className="studio-notice studio-notice--error studio-mt-xs">{error}</p>}
    </div>
  )
}
