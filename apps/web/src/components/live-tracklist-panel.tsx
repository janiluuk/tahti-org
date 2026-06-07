// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import type { TracklistEntry } from '@tahti/shared'
import { TracklistView } from '@/components/tracklist/tracklist-view'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

/** STREAM-008 phase 4: poll live chromaprint tracklist while channel is LIVE. */
export function LiveTracklistPanel({
  slug,
  heading = 'Now playing',
  showPlaceholder = false,
  className,
}: {
  slug: string
  heading?: string
  /** When true, show a waiting message before the first fingerprint arrives. */
  showPlaceholder?: boolean
  className?: string
}) {
  const [entries, setEntries] = useState<TracklistEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/channels/${slug}/live-fingerprints`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { tracklist?: TracklistEntry[] }
        if (!cancelled) {
          setLoaded(true)
          if (data.tracklist?.length) setEntries(data.tracklist)
        }
      } catch {
        // best-effort — fingerprint sidecar may not be running yet
      }
    }

    void poll()
    const timer = setInterval(() => void poll(), 30_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [slug])

  if (entries.length === 0) {
    if (!showPlaceholder || !loaded) {
      if (showPlaceholder && !loaded) {
        return (
          <p
            className={className ? `${className} ch-live-tracklist-wait` : 'ch-live-tracklist-wait'}
          >
            Detecting tracks…
          </p>
        )
      }
      return null
    }
    return (
      <p className={className ? `${className} ch-live-tracklist-wait` : 'ch-live-tracklist-wait'}>
        Waiting for track detection — sidecar posts fingerprints every ~30s.
      </p>
    )
  }

  return (
    <section
      className={className ? `ch-live-tracklist ${className}` : 'ch-live-tracklist'}
      aria-label="Live tracklist"
    >
      <h2 className="ch-live-tracklist-heading">{heading}</h2>
      <TracklistView entries={entries} />
    </section>
  )
}
