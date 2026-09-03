'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
import { updateAutoPublishBroadcast } from './publish-actions'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

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
    } else {
      const preflightResponse = await fetch(`${API_BASE}/api/me/channel/preflight`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ autoPublish: next }),
      })
      if (!preflightResponse.ok) {
        setError('Publishing default saved, but this broadcast could not be updated.')
      }
    }
    setPending(false)
  }

  return (
    <div className="broadcast-studio__toggle-control">
      <span className="broadcast-studio__toggle-label">Publish automatically</span>
      <button
        type="button"
        className={`broadcast-studio__red-toggle${enabled ? ' is-active' : ''}`}
        aria-pressed={enabled}
        aria-label={enabled ? 'Disable automatic publishing' : 'Enable automatic publishing'}
        disabled={pending}
        onClick={() => void onToggle()}
      >
        <span aria-hidden />
      </button>
      {error && <p className="studio-notice studio-notice--error studio-mt-xs">{error}</p>}
    </div>
  )
}
