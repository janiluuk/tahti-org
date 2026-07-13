// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { Panel } from '@tahti/ui'
import { updateChatSubscribersOnly } from './moderator-actions'

export function ChatSettingsPanel({ initialSubscribersOnly }: { initialSubscribersOnly: boolean }) {
  const [subscribersOnly, setSubscribersOnly] = useState(initialSubscribersOnly)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggle(checked: boolean) {
    setError(null)
    setSubscribersOnly(checked)
    startTransition(async () => {
      const res = await updateChatSubscribersOnly(checked)
      if (res.error) {
        setError(res.error)
        setSubscribersOnly(!checked)
      }
    })
  }

  return (
    <Panel title="Chat access" headerTight>
      <label className="studio-toggle-row">
        <input
          type="checkbox"
          className="studio-toggle-checkbox"
          checked={subscribersOnly}
          onChange={(e) => toggle(e.target.checked)}
          disabled={isPending}
        />
        <span className="studio-toggle-label">Subscribers-only chat</span>
      </label>
      <p className="studio-text-muted-sm studio-mt-xs">
        Only active fan-subscribers can post in your live chat. Everyone can still read it. Default:
        off (anyone can chat).
      </p>
      {error && <p className="studio-text-error studio-mt-xs">{error}</p>}
    </Panel>
  )
}
