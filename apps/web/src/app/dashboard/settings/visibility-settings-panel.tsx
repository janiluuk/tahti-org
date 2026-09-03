// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button, ButtonIcon, Panel } from '@tahti/ui'
import { updateChannelProfile } from '../channel-identity-actions'

export type VisibilitySettings = {
  showJoinDate: boolean
  showFollowers: boolean
  showFollowing: boolean
  showDailyListeners: boolean
  chatEnabled: boolean
  showPageHero: boolean
}

const FIELD_LABELS: Record<keyof VisibilitySettings, string> = {
  showJoinDate: 'Show join date on my profile',
  showFollowers: 'Show my followers on my profile',
  showFollowing: 'Show who I follow on my profile',
  showDailyListeners: 'Show today’s listener count in my chat',
  chatEnabled: 'Enable live chat on my channel',
  showPageHero: 'Show the header card (avatar, quick facts, actions) on my profile and channel',
}

const ALL_FIELDS = Object.keys(FIELD_LABELS) as Array<keyof VisibilitySettings>

interface Props {
  initial: VisibilitySettings
  /** Render without the outer Panel/title — used when embedded in another section's chrome. */
  bare?: boolean
  /** Render without its own Save button — the parent section saves on the caller's behalf. */
  hideSave?: boolean
  /** Restrict which toggles render here (default: all). */
  fields?: Array<keyof VisibilitySettings>
  onDraftChange?: (settings: VisibilitySettings) => void
}

export function VisibilitySettingsPanel({
  initial,
  bare = false,
  hideSave = false,
  fields = ALL_FIELDS,
  onDraftChange,
}: Props) {
  const [settings, setSettings] = useState(initial)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    onDraftChange?.(settings)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

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

  const toggles = (
    <>
      {fields.map((key) => (
        <label className="studio-toggle-row studio-mt-sm" key={key}>
          <input
            type="checkbox"
            className="studio-toggle-checkbox"
            checked={settings[key]}
            onChange={(event) => toggle(key, event.target.checked)}
            disabled={isPending}
          />
          <span className="studio-toggle-label">{FIELD_LABELS[key]}</span>
        </label>
      ))}
      {!hideSave ? (
        <div className="studio-schedule-row studio-mt-md">
          <Button onClick={save} disabled={isPending} variant="primary">
            <ButtonIcon name="save" />
            {isPending ? 'Saving…' : 'Save visibility'}
          </Button>
          {message && <p className="studio-notice studio-notice--success">{message}</p>}
          {error && <p className="studio-text-error">{error}</p>}
        </div>
      ) : null}
    </>
  )

  if (bare) return toggles

  return (
    <Panel
      title="Visibility"
      description="Choose what appears publicly and whether listeners can use live chat."
    >
      {toggles}
    </Panel>
  )
}
