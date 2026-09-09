// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { restartDiscordBot } from '../actions'

export function DiscordBotRestartButton() {
  const [pending, setPending] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function run() {
    if (
      !window.confirm(
        'Restart the Discord bot container? It will briefly disconnect from voice/Discord.',
      )
    ) {
      return
    }
    setPending(true)
    setMsg(null)
    const { error } = await restartDiscordBot()
    setPending(false)
    if (error) {
      setMsg(error)
      return
    }
    window.location.reload()
  }

  return (
    <p className="admin-dashboard-health-footer">
      <button
        type="button"
        className="admin-btn admin-btn--sm"
        disabled={pending}
        onClick={() => void run()}
      >
        {pending ? 'Restarting…' : 'Restart Discord bot'}
      </button>
      {msg ? <span className="admin-err"> {msg}</span> : null}
    </p>
  )
}
