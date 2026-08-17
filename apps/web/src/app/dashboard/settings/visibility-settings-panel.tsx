// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { Button, ButtonIcon, Panel } from '@tahti/ui'
import { updateChannelProfile } from '../channel-identity-actions'

export type VisibilitySettings = {
  showJoinDate: boolean
  showFollowers: boolean
  showFollowing: boolean
  showDailyListeners: boolean
  chatEnabled: boolean
}

export function VisibilitySettingsPanel({ initial }: { initial: VisibilitySettings }) {
  const [settings, setSettings] = useState(initial)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggle(key: keyof VisibilitySettings, value: boolean) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  function save() {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const result = await updateChannelProfile(settings)
      if (result.error) setError(result.error)
      else setMessage('Visibility settings saved.')
    })
  }

  return (
    <Panel
      title="Visibility"
      description="Choose what appears publicly and whether listeners can use live chat."
    >
      {(
        [
          ['showJoinDate', 'Show join date on my profile'],
          ['showFollowers', 'Show my followers on my profile'],
          ['showFollowing', 'Show who I follow on my profile'],
          ['showDailyListeners', 'Show today’s listener count in my chat'],
          ['chatEnabled', 'Enable live chat on my channel'],
        ] as const
      ).map(([key, label]) => (
        <label className="studio-toggle-row studio-mt-sm" key={key}>
          <input
            type="checkbox"
            className="studio-toggle-checkbox"
            checked={settings[key]}
            onChange={(event) => toggle(key, event.target.checked)}
            disabled={isPending}
          />
          <span className="studio-toggle-label">{label}</span>
        </label>
      ))}
      <div className="studio-schedule-row studio-mt-md">
        <Button onClick={save} disabled={isPending} variant="primary">
          <ButtonIcon name="save" />
          {isPending ? 'Saving…' : 'Save visibility'}
        </Button>
        {message && <p className="studio-notice studio-notice--success">{message}</p>}
        {error && <p className="studio-text-error">{error}</p>}
      </div>
    </Panel>
  )
}
