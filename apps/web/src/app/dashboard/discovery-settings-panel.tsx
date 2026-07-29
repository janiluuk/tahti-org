// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { Panel } from '@tahti/ui'
import { updateTopListsOptOut } from './discovery-settings-actions'

export function DiscoverySettingsPanel({
  initialTopListsOptOut,
}: {
  initialTopListsOptOut: boolean
}) {
  const [optOut, setOptOut] = useState(initialTopListsOptOut)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggle(checked: boolean) {
    setError(null)
    setOptOut(checked)
    startTransition(async () => {
      const res = await updateTopListsOptOut(checked)
      if (res.error) {
        setError(res.error)
        setOptOut(!checked)
      }
    })
  }

  return (
    <Panel title="Top lists" headerTight>
      <label className="studio-toggle-row">
        <input
          type="checkbox"
          className="studio-toggle-checkbox"
          checked={optOut}
          onChange={(e) => toggle(e.target.checked)}
          disabled={isPending}
        />
        <span className="studio-toggle-label">Keep new tracks out of top lists</span>
      </label>
      <p className="studio-text-muted-sm studio-mt-xs">
        Applied to tracks you upload from now on — each track can still be switched back in
        individually afterward. Doesn&apos;t affect tracks already uploaded.
      </p>
      {error && <p className="studio-text-error studio-mt-xs">{error}</p>}
    </Panel>
  )
}
