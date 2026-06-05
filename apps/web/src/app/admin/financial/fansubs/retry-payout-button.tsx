// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { retryFanSubPayout } from '../../actions'

export function RetryPayoutButton({ payoutId }: { payoutId: string }) {
  const [pending, setPending] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function onRetry() {
    setPending(true)
    setMsg(null)
    const { error } = await retryFanSubPayout(payoutId)
    setPending(false)
    if (error) {
      setMsg(error)
      return
    }
    window.location.reload()
  }

  return (
    <span>
      <button type="button" disabled={pending} onClick={onRetry}>
        {pending ? '…' : 'Retry'}
      </button>
      {msg ? <span className="admin-err"> {msg}</span> : null}
    </span>
  )
}
