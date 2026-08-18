'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { StudioShell } from '@tahti/ui'
import { StreamManagerModal } from './_stream-manager-modal'
import { StreamManagerContext } from './_stream-manager-context'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'
/** Layouts don't re-fetch on client-side navigation within the same route
 * tree — only on a hard load or an explicit router.refresh(). Going live
 * from OBS/Mixxx directly (no browser round-trip through /dashboard/
 * broadcast, whose own polling would've called router.refresh()) left the
 * top-nav icon showing stale "offline" state — still a plain Link instead
 * of the stream-manager button — until the next full navigation. Poll here
 * so it self-corrects within a few seconds regardless of how you went live. */
const LIVE_POLL_MS = 5000

type StudioShellClientProps = Omit<ComponentProps<typeof StudioShell>, 'children' | 'onGoLiveClick'> & {
  children: ReactNode
  channelSlug?: string
}

/** Client wrapper so the top-nav go-live icon (packages/ui, no data access of
 * its own) can open a modal that needs this app's ChatPanel + slug + session
 * — StudioShell just gets a callback, this owns the actual open/close state. */
export function StudioShellClient({
  channelSlug,
  isLive: initialIsLive,
  ...shellProps
}: StudioShellClientProps) {
  const [streamManagerOpen, setStreamManagerOpen] = useState(false)
  const [isLive, setIsLive] = useState(Boolean(initialIsLive))

  useEffect(() => {
    setIsLive(Boolean(initialIsLive))
  }, [initialIsLive])

  useEffect(() => {
    if (!channelSlug) return
    let cancelled = false
    async function poll() {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' })
        if (!res.ok || cancelled) return
        const me = (await res.json()) as { channel?: { state?: string } }
        setIsLive(me.channel?.state === 'LIVE')
      } catch {
        // ignore polling errors — keep showing the last known state
      }
    }
    const id = window.setInterval(poll, LIVE_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [channelSlug])

  const openStreamManager = () => setStreamManagerOpen(true)

  return (
    <StreamManagerContext.Provider value={channelSlug ? openStreamManager : null}>
      <StudioShell {...shellProps} isLive={isLive} onGoLiveClick={openStreamManager} />
      {channelSlug && (
        <StreamManagerModal
          slug={channelSlug}
          displayName={shellProps.displayName}
          open={streamManagerOpen}
          onClose={() => setStreamManagerOpen(false)}
        />
      )}
    </StreamManagerContext.Provider>
  )
}
