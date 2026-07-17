// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { Panel } from '@tahti/ui'
import { updateChannelCommentsEnabled, updateCommentDefaults } from './comment-settings-actions'

export function CommentSettingsPanel({
  initialChannelCommentsEnabled,
  initialDefaultTrackCommentsEnabled,
  initialDefaultChannelCommentsEnabled,
}: {
  initialChannelCommentsEnabled: boolean
  initialDefaultTrackCommentsEnabled: boolean
  initialDefaultChannelCommentsEnabled: boolean
}) {
  const [channelEnabled, setChannelEnabled] = useState(initialChannelCommentsEnabled)
  const [defaultTrack, setDefaultTrack] = useState(initialDefaultTrackCommentsEnabled)
  const [defaultChannel, setDefaultChannel] = useState(initialDefaultChannelCommentsEnabled)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggleChannel(checked: boolean) {
    setError(null)
    setChannelEnabled(checked)
    startTransition(async () => {
      const res = await updateChannelCommentsEnabled(checked)
      if (res.error) {
        setError(res.error)
        setChannelEnabled(!checked)
      }
    })
  }

  function toggleDefaultTrack(checked: boolean) {
    setError(null)
    setDefaultTrack(checked)
    startTransition(async () => {
      const res = await updateCommentDefaults({ defaultTrackCommentsEnabled: checked })
      if (res.error) {
        setError(res.error)
        setDefaultTrack(!checked)
      }
    })
  }

  function toggleDefaultChannel(checked: boolean) {
    setError(null)
    setDefaultChannel(checked)
    startTransition(async () => {
      const res = await updateCommentDefaults({ defaultChannelCommentsEnabled: checked })
      if (res.error) {
        setError(res.error)
        setDefaultChannel(!checked)
      }
    })
  }

  return (
    <Panel title="Comments" headerTight>
      <label className="studio-toggle-row">
        <input
          type="checkbox"
          className="studio-toggle-checkbox"
          checked={channelEnabled}
          onChange={(e) => toggleChannel(e.target.checked)}
          disabled={isPending}
        />
        <span className="studio-toggle-label">Allow comments on my channel</span>
      </label>
      <p className="studio-text-muted-sm studio-mt-xs">
        Turns commenting off for your channel page immediately. Existing comments stay visible.
      </p>

      <label className="studio-toggle-row studio-mt-sm">
        <input
          type="checkbox"
          className="studio-toggle-checkbox"
          checked={defaultChannel}
          onChange={(e) => toggleDefaultChannel(e.target.checked)}
          disabled={isPending}
        />
        <span className="studio-toggle-label">Default: comments on for my channel</span>
      </label>

      <label className="studio-toggle-row studio-mt-sm">
        <input
          type="checkbox"
          className="studio-toggle-checkbox"
          checked={defaultTrack}
          onChange={(e) => toggleDefaultTrack(e.target.checked)}
          disabled={isPending}
        />
        <span className="studio-toggle-label">Default: comments on for new tracks</span>
      </label>
      <p className="studio-text-muted-sm studio-mt-xs">
        Applied when you upload a new track — each track can still be toggled individually
        afterward.
      </p>
      {error && <p className="studio-text-error studio-mt-xs">{error}</p>}
    </Panel>
  )
}
