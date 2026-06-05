// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { endBroadcast } from './actions'

export function EndBroadcastBtn() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleClick() {
    if (!confirm('End your live broadcast now?')) return
    setLoading(true)
    try {
      const result = await endBroadcast()
      if (result.ok) {
        router.refresh()
      } else {
        alert(result.error ?? 'Could not end broadcast')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      className="db-end-broadcast-btn"
      onClick={handleClick}
      disabled={loading}
      aria-label="End live broadcast"
    >
      {loading ? (
        '…'
      ) : (
        <>
          <span className="db-end-broadcast-icon" aria-hidden>
            ■
          </span>{' '}
          End Broadcast
        </>
      )}
    </button>
  )
}
