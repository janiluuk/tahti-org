'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState, type ComponentProps, type ReactNode } from 'react'
import { StudioShell } from '@tahti/ui'
import { StreamManagerModal } from './_stream-manager-modal'

type StudioShellClientProps = Omit<ComponentProps<typeof StudioShell>, 'children' | 'onGoLiveClick'> & {
  children: ReactNode
  channelSlug?: string
}

/** Client wrapper so the top-nav go-live icon (packages/ui, no data access of
 * its own) can open a modal that needs this app's ChatPanel + slug + session
 * — StudioShell just gets a callback, this owns the actual open/close state. */
export function StudioShellClient({ channelSlug, ...shellProps }: StudioShellClientProps) {
  const [streamManagerOpen, setStreamManagerOpen] = useState(false)

  return (
    <>
      <StudioShell {...shellProps} onGoLiveClick={() => setStreamManagerOpen(true)} />
      {channelSlug && (
        <StreamManagerModal
          slug={channelSlug}
          displayName={shellProps.displayName}
          open={streamManagerOpen}
          onClose={() => setStreamManagerOpen(false)}
        />
      )}
    </>
  )
}
