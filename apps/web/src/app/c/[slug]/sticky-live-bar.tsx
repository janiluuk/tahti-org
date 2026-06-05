'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Props = {
  slug: string
  artistName: string
  isFlac: boolean
}

/** PLAT-032: fixed-bottom banner when channel is live. */
export function StickyLiveBar({ slug, artistName, isFlac }: Props) {
  const [listeners, setListeners] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'
        const res = await fetch(`${apiBase}/api/channels/${slug}/presence`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { numClients: number }
        setListeners(data.numClients)
      } catch {
        // ignore
      }
    }
    void poll()
    const id = setInterval(poll, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [slug])

  return (
    <div className="ch-sticky-live-bar" role="status">
      <span className="ch-sticky-live-dot" aria-hidden />
      <span className="ch-sticky-live-text">
        <strong>{artistName}</strong> is live
        {listeners != null && (
          <span className="ch-sticky-live-listeners"> · {listeners} listening</span>
        )}
      </span>
      {isFlac && <span className="ch-sticky-flac-badge">FLAC</span>}
      <Link href={`/c/${slug}#live-player`} className="ch-sticky-live-open">
        Open →
      </Link>
    </div>
  )
}
