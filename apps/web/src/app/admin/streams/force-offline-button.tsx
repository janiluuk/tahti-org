// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { forceChannelOffline } from '../actions'

export function ForceOfflineButton({ slug }: { slug: string }) {
  const [pending, setPending] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function onForce() {
    if (!window.confirm(`Force ${slug} offline? This ends the broadcast immediately.`)) return
    setPending(true)
    setMsg(null)
    const { error } = await forceChannelOffline(slug)
    setPending(false)
    if (error) {
      setMsg(error)
      return
    }
    window.location.reload()
  }

  return (
    <span>
      <button type="button" className="admin-btn-danger" disabled={pending} onClick={onForce}>
        {pending ? 'Stopping…' : 'Force offline'}
      </button>
      {msg ? <span className="admin-err"> {msg}</span> : null}
    </span>
  )
}
