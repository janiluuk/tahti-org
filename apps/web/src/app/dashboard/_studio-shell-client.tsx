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

type StudioShellClientProps = Omit<
  ComponentProps<typeof StudioShell>,
  'children' | 'onGoLiveClick'
> & {
  children: ReactNode
  channelSlug?: string
  /** True only for a real broadcast (Broadcast.wentLiveAt/Channel.goneLiveAt
   * set) — distinct from `isLive`, which the 24/7 rotation also satisfies
   * (see the comment in dashboard/layout.tsx). Decides what the stream
   * manager modal shows: live stats+chat, or rotation/playlist controls. */
  isReallyLive?: boolean
}

/** Client wrapper so the top-nav go-live icon (packages/ui, no data access of
 * its own) can open a modal that needs this app's ChatPanel + slug + session
 * — StudioShell just gets a callback, this owns the actual open/close state. */
export function StudioShellClient({
  channelSlug,
  isLive: initialIsLive,
  isReallyLive: initialIsReallyLive,
  goneLiveAt: initialGoneLiveAt,
  nextBroadcastAt: initialNextBroadcastAt,
  ...shellProps
}: StudioShellClientProps) {
  const [streamManagerOpen, setStreamManagerOpen] = useState(false)
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

  const openStreamManager = () => setStreamManagerOpen(true)

  return (
    // Two nested wrappers, not one — both load-bearing:
    //
    // 1. The outer .tahti-studio carries the dark-theme --tahti-* variable
    //    bridge (defined only under [data-tahti-ui='studio'].tahti-studio —
    //    see the block at the top of brand-studio.css). StreamManagerModal
    //    renders here as a *sibling* of <StudioShell>, not inside it, so
    //    without a shared ancestor providing that bridge, CSS custom
    //    properties like --tahti-text never reach it or anything inside it
    //    (Panel headings, buttons, …) — they'd inherit the light-admin
    //    default instead and render as near-invisible dark-on-dark text.
    //
    // 2. The inner plain div keeps the modal from being a *direct* child of
    //    the outer .tahti-studio: brand-studio.css resets every direct child
    //    of .tahti-studio to position:relative (so page content sits above
    //    the fixed WebGL background canvas), which would clobber the modal's
    //    own position:fixed overlay. One extra nesting level and that reset
    //    never reaches it, without relying on a CSS specificity tie-break.
    <div data-tahti-ui="studio" className="tahti-studio">
      <div>
        <StreamManagerContext.Provider value={channelSlug ? openStreamManager : null}>
          <StudioShell
            {...shellProps}
            isLive={isLive}
            isReallyLive={isReallyLive}
            goneLiveAt={goneLiveAt}
            nextBroadcastAt={nextBroadcastAt}
            onGoLiveClick={openStreamManager}
          />
          {channelSlug && (
            <StreamManagerModal
              slug={channelSlug}
              displayName={shellProps.displayName}
              open={streamManagerOpen}
              onClose={() => setStreamManagerOpen(false)}
              isReallyLive={isReallyLive}
            />
          )}
        </StreamManagerContext.Provider>
      </div>
    </div>
  )
}
