'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import NextLink from 'next/link'
import { goLive } from './actions'
import { useStreamManager } from './_stream-manager-context'

/** The dashboard header's go-live pill, shown on every dashboard page. Once
 * the artist is already connected and in PREVIEW (sound-checking), this goes
 * straight to LIVE in one click instead of sending them to the broadcast
 * studio page to find the same button there — they're already streaming,
 * there's nothing left to set up. OFFLINE stays a link to the broadcast
 * studio, where there's actually something to do (set up ingest). LIVE opens
 * the stream manager (status, listeners, chat, end stream) in place instead
 * of sending them to the setup wizard, which has nothing relevant left to
 * show once you're already on air. */
export function HeaderGoLiveAction({
  state,
  className,
  dotClassName,
  label,
}: {
  state: string | undefined
  className: string
  dotClassName: string
  label: string
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const openStreamManager = useStreamManager()

  if (state === 'LIVE' && openStreamManager) {
    return (
      <button type="button" className={className} onClick={openStreamManager}>
        <span className={dotClassName} aria-hidden style={{ width: 6, height: 6 }} />
        {label}
      </button>
    )
  }

  if (state !== 'PREVIEW') {
    return (
      <NextLink href="/dashboard/broadcast" className={className}>
        <span className={dotClassName} aria-hidden style={{ width: 6, height: 6 }} />
        {label}
      </NextLink>
    )
  }

  async function handleClick() {
    setLoading(true)
    try {
      const result = await goLive()
      if (result.ok) {
        router.refresh()
      } else {
        alert(result.error ?? 'Could not go live')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      className={className}
      style={{ cursor: 'pointer' }}
      onClick={() => void handleClick()}
      disabled={loading}
      aria-label="Go live"
    >
      <span className={dotClassName} aria-hidden style={{ width: 6, height: 6 }} />
      {loading ? 'Going live…' : label}
    </button>
  )
}
