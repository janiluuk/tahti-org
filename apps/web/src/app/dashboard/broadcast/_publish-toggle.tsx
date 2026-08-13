'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
import { updateAutoPublishBroadcast } from './publish-actions'

/** Persistent per-channel default for whether a finished, recorded broadcast is
 * published (public) right away. Pairs with RecordingToggle — this only matters
 * when recording is on. Editing the archived audio afterward is unaffected
 * either way; this just decides the starting visibility. */
export function PublishToggle({ initialEnabled }: { initialEnabled: boolean }) {
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
    const res = await updateAutoPublishBroadcast(next)
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
          {enabled ? 'Always publish' : 'Publish manually'}
        </span>
      </button>
      <p className="broadcast-studio__record-hint">
        {enabled
          ? "This show's archive goes public as soon as it's recorded — edit the audio anytime after, publishing doesn't lock it."
          : "This show's archive stays private until you publish it yourself from the archive."}
      </p>
      {error && <p className="studio-notice studio-notice--error studio-mt-xs">{error}</p>}
    </div>
  )
}
