// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import NextLink from 'next/link'
import { Alert, Stack, Text } from '@tahti/ui'
import { setRotationEnabled } from './setup-channel-actions'
import { wizardStepHref } from './_wizard-steps'

export function StepRotation({
  trackCount,
  initialEnabled,
}: {
  trackCount: number
  initialEnabled: boolean
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toggle(next: boolean) {
    setError(null)
    startTransition(async () => {
      const res = await setRotationEnabled(next)
      if (res.error) return setError(res.error)
      setEnabled(next)
    })
  }

  if (trackCount === 0) {
    return (
      <Stack gap={4}>
        <Alert variant="info">
          You have no tracks yet, so there is nothing to put in 24/7 rotation. Upload a track first
          — you can finish this step any time from the dashboard.
        </Alert>
        <NextLink href="/dashboard/upload" className="db-quick-action db-quick-action--primary">
          Upload a track
        </NextLink>
        <NextLink href={wizardStepHref(5)} className="db-quick-action">
          Skip for now →
        </NextLink>
      </Stack>
    )
  }

  return (
    <Stack gap={4}>
      {error && <Alert variant="error">{error}</Alert>}
      <label className="signup-genre-chip">
        <input
          type="checkbox"
          checked={enabled}
          disabled={isPending}
          onChange={(e) => toggle(e.target.checked)}
        />
        <span>Keep my channel playing 24/7 when I am offline</span>
      </label>
      <Text tone="muted">
        {trackCount} {trackCount === 1 ? 'track' : 'tracks'} ready. Choose which ones play, and in
        what order, in the playlist editor.
      </Text>
      <NextLink
        href="/dashboard/channel/playlist?from=setup"
        className="db-quick-action db-quick-action--primary"
      >
        Edit the rotation playlist
      </NextLink>
      <NextLink href={wizardStepHref(5)} className="db-quick-action">
        Continue →
      </NextLink>
    </Stack>
  )
}
