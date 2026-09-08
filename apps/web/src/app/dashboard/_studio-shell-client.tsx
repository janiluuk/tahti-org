'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { StudioShell } from '@tahti/ui'
import { resolveClientApiUrl } from '@/lib/api-url'

const API_BASE = resolveClientApiUrl()
/** Layouts don't re-fetch on client-side navigation within the same route
 * tree — only on a hard load or an explicit router.refresh(). Going live
 * from OBS/Mixxx directly (no browser round-trip through /dashboard/
 * broadcast, whose own polling would've called router.refresh()) left the
 * top-nav icon showing stale "offline" state until the next full navigation.
 * Poll here so it self-corrects within a few seconds regardless of how you
 * went live. */
const LIVE_POLL_MS = 5000

type StudioShellClientProps = Omit<ComponentProps<typeof StudioShell>, 'children'> & {
  children: ReactNode
  channelSlug?: string
  /** True only for a real broadcast (Broadcast.wentLiveAt/Channel.goneLiveAt
   * set) — distinct from `isLive`, which the 24/7 rotation also satisfies
   * (see the comment in dashboard/layout.tsx). */
  isReallyLive?: boolean
}

/** Client wrapper so the top-nav live indicator can poll channel state without
 * a full navigation after going live from OBS/Mixxx. */
export function StudioShellClient({
  channelSlug,
  isLive: initialIsLive,
  isReallyLive: initialIsReallyLive,
  goneLiveAt: initialGoneLiveAt,
  nextBroadcastAt: initialNextBroadcastAt,
  ...shellProps
}: StudioShellClientProps) {
  const [isLive, setIsLive] = useState(Boolean(initialIsLive))
  const [isReallyLive, setIsReallyLive] = useState(Boolean(initialIsReallyLive))
  const [goneLiveAt, setGoneLiveAt] = useState(initialGoneLiveAt ?? null)
  const [nextBroadcastAt, setNextBroadcastAt] = useState(initialNextBroadcastAt ?? null)

  useEffect(() => {
    setIsLive(Boolean(initialIsLive))
  }, [initialIsLive])

  useEffect(() => {
    setIsReallyLive(Boolean(initialIsReallyLive))
  }, [initialIsReallyLive])

  useEffect(() => {
    setGoneLiveAt(initialGoneLiveAt ?? null)
  }, [initialGoneLiveAt])

  useEffect(() => {
    setNextBroadcastAt(initialNextBroadcastAt ?? null)
  }, [initialNextBroadcastAt])

  useEffect(() => {
    if (!channelSlug) return
    let cancelled = false
    async function poll() {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' })
        if (!res.ok || cancelled) return
        const me = (await res.json()) as {
          channel?: { state?: string; goneLiveAt?: string | null; nextBroadcastAt?: string | null }
        }
        // Rotation can report LIVE at the channel level too. Keep the shell's
        // live signal reserved for an actual artist broadcast.
        const reallyLive = Boolean(me.channel?.goneLiveAt)
        setIsLive(reallyLive)
        setIsReallyLive(reallyLive)
        setGoneLiveAt(me.channel?.goneLiveAt ?? null)
        setNextBroadcastAt(me.channel?.nextBroadcastAt ?? null)
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

  return (
    <StudioShell
      {...shellProps}
      isLive={isLive}
      isReallyLive={isReallyLive}
      goneLiveAt={goneLiveAt}
      nextBroadcastAt={nextBroadcastAt}
    />
  )
}
