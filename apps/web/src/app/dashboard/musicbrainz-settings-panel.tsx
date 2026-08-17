// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { Panel, Button } from '@tahti/ui'
import { disconnectMusicbrainz, setMusicbrainzDefault } from './release-actions'

export function MusicbrainzSettingsPanel({
  initialConnected,
  initialUsername,
  initialConfigured,
  initialDefault,
}: {
  initialConnected: boolean
  initialUsername: string | null
  initialConfigured: boolean
  initialDefault: boolean | null
}) {
  const [connected, setConnected] = useState(initialConnected)
  const [username, setUsername] = useState(initialUsername)
  const [pref, setPref] = useState(initialDefault)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function choosePref(value: boolean | null) {
    setError(null)
    setPref(value)
    startTransition(async () => {
      const res = await setMusicbrainzDefault(value)
      if (res.error) {
        setError(res.error)
        setPref(pref)
      }
    })
  }

  function disconnect() {
    setError(null)
    startTransition(async () => {
      const res = await disconnectMusicbrainz()
      if (res.error) {
        setError(res.error)
        return
      }
      setConnected(false)
      setUsername(null)
    })
  }

  if (!initialConfigured) {
    return (
      <Panel title="MusicBrainz" headerTight>
        <p className="studio-text-muted-sm">Not available yet.</p>
      </Panel>
    )
  }

  return (
    <Panel
      title="MusicBrainz"
      headerTight
      description="Register your published releases with MusicBrainz's public database."
    >
      {connected ? (
        <div className="studio-row--between studio-gap-xs">
          <span className="studio-text-sm">Connected{username ? ` as ${username}` : ''}.</span>
          <Button onClick={disconnect} disabled={isPending} variant="ghost" size="sm">
            Disconnect
          </Button>
        </div>
      ) : (
        <a href="/api/me/musicbrainz/oauth/start" className="ui-btn ui-btn--sm ui-btn--primary">
          Connect MusicBrainz account
        </a>
      )}

      <p className="studio-label studio-mt-md">When you publish a release</p>
      <div className="studio-radio-group studio-mt-xs">
        <label className="studio-toggle-row">
          <input
            type="radio"
            name="mb-default"
            checked={pref === null}
            disabled={isPending}
            onChange={() => choosePref(null)}
          />
          <span className="studio-toggle-label">Ask me each time</span>
        </label>
        <label className="studio-toggle-row">
          <input
            type="radio"
            name="mb-default"
            checked={pref === true}
            disabled={isPending}
            onChange={() => choosePref(true)}
          />
          <span className="studio-toggle-label">Always offer to register with MusicBrainz</span>
        </label>
        <label className="studio-toggle-row">
          <input
            type="radio"
            name="mb-default"
            checked={pref === false}
            disabled={isPending}
            onChange={() => choosePref(false)}
          />
          <span className="studio-toggle-label">Never ask</span>
        </label>
      </div>
      <p className="studio-text-muted-sm studio-mt-xs">
        Registering opens MusicBrainz&rsquo;s own Add Release form, pre-filled with your release
        info — you review and submit it there yourself.
      </p>
      {error && <p className="studio-text-error studio-mt-xs">{error}</p>}
    </Panel>
  )
}
