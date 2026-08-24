'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

type GoLiveStatusProps = {
  /** True only for a real broadcast (Channel.goneLiveAt set) — the 24/7
   * rotation also flips the channel "online" without this being true, so
   * this prop alone decides the icon's green/red color. */
  isReallyLive: boolean
  goneLiveAt?: string | null
  /** Artist-set "next broadcast" hint (channel-schedule-panel.tsx) — shown as
   * a countdown when set and still in the future. */
  nextBroadcastAt?: string | null
  /** Opens the stream manager (modal or page) — the small popover this icon
   * opens is a status summary only; this button is the way out of it. */
  onOpenManager?: () => void
}

function IconGoLive() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="3" fill="currentColor" />
      <path
        d="M4.2 4.2a5.4 5.4 0 0 0 0 7.6M11.8 4.2a5.4 5.4 0 0 1 0 7.6M2.3 2.3a8.2 8.2 0 0 0 0 11.4M13.7 2.3a8.2 8.2 0 0 1 0 11.4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconManager() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="1.5"
        y="2.5"
        width="13"
        height="9"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M5.5 14h5M8 11.5V14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/** "1:24:07" while live, "in 2h 10m" for a future scheduled slot. */
function formatClock(totalSec: number): string {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

function formatCountdown(totalSec: number): string {
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** Top-nav go-live icon: green while actually on air, red otherwise. Click
 * opens a small status popover (elapsed time, or a countdown to the next
 * scheduled slot) with a button through to the stream manager — distinct
 * from clicking straight through, so checking status never leaves the page
 * you're on. */
export function GoLiveStatus({
  isReallyLive,
  goneLiveAt,
  nextBroadcastAt,
  onOpenManager,
}: GoLiveStatusProps) {
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!onOpenManager) {
    return (
      <Link
        href="/dashboard/broadcast"
        className="studio-top-nav__icon-btn studio-top-nav__golive-btn"
        aria-label="Go live"
        title="Go live"
      >
        <IconGoLive />
      </Link>
    )
  }

  const nextBroadcastMs = nextBroadcastAt ? new Date(nextBroadcastAt).getTime() : null
  const isScheduled = !isReallyLive && nextBroadcastMs !== null && nextBroadcastMs > now

  let statusLabel: string
  let statusDetail: string | null = null
  if (isReallyLive && goneLiveAt) {
    statusLabel = 'Live'
    statusDetail = formatClock(
      Math.max(0, Math.floor((now - new Date(goneLiveAt).getTime()) / 1000)),
    )
  } else if (isScheduled && nextBroadcastMs !== null) {
    statusLabel = 'Scheduled'
    statusDetail = `in ${formatCountdown(Math.max(0, Math.floor((nextBroadcastMs - now) / 1000)))}`
  } else {
    statusLabel = 'Offline'
  }

  return (
    <div className="studio-top-nav__golive" ref={ref}>
      <button
        type="button"
        className={`studio-top-nav__icon-btn studio-top-nav__golive-btn${
          isReallyLive ? ' studio-top-nav__golive-btn--live' : ''
        }`}
        aria-label="Stream status"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Stream status"
        onClick={() => setOpen((v) => !v)}
      >
        <IconGoLive />
      </button>
      {open && (
        <div className="studio-top-nav__menu studio-top-nav__golive-menu" role="menu">
          <div className="studio-top-nav__golive-status">
            <span
              className={`studio-top-nav__golive-dot${
                isReallyLive ? ' studio-top-nav__golive-dot--live' : ''
              }`}
              aria-hidden
            />
            <span className="studio-top-nav__golive-label">{statusLabel}</span>
            {statusDetail && <span className="studio-top-nav__golive-detail">{statusDetail}</span>}
          </div>
          <button
            type="button"
            className="studio-top-nav__golive-manage"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onOpenManager()
            }}
          >
            <IconManager />
            Open stream manager
          </button>
        </div>
      )}
    </div>
  )
}
