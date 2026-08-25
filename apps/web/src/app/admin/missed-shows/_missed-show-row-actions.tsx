// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { MissedLiveShowFlagView } from '@tahti/shared'
import { updateMissedLiveShowFlag } from '../actions'

export function MissedShowRowActions({ flag }: { flag: MissedLiveShowFlagView }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function setStatus(status: string) {
    setPending(true)
    setError(null)
    const result = await updateMissedLiveShowFlag(flag.id, { status })
    setPending(false)
    if (result.error) setError(result.error)
    else window.location.reload()
  }

  return (
    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <Link href={`/admin/users/${flag.channel.userId}`} className="admin-btn admin-btn--sm">
        Inspect
      </Link>
      <Link
        href={`/dashboard/messages?username=${encodeURIComponent(flag.channel.username)}`}
        className="admin-btn admin-btn--sm"
      >
        Message
      </Link>
      {flag.status !== 'REVIEWING' && (
        <button
          type="button"
          className="admin-btn admin-btn--sm"
          disabled={pending}
          onClick={() => setStatus('REVIEWING')}
        >
          Reviewing
        </button>
      )}
      {flag.status !== 'ACTIONED' && (
        <button
          type="button"
          className="admin-btn admin-btn--sm"
          disabled={pending}
          onClick={() => setStatus('ACTIONED')}
        >
          Actioned
        </button>
      )}
      {flag.status !== 'DISMISSED' && (
        <button
          type="button"
          className="admin-btn admin-btn--sm"
          disabled={pending}
          onClick={() => setStatus('DISMISSED')}
        >
          Dismiss
        </button>
      )}
      {error ? <span className="admin-stat-sub">{error}</span> : null}
    </div>
  )
}
