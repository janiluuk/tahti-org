// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import type { TracklistEntry } from '@tahti/shared'
import { TracklistView } from '@/components/tracklist/tracklist-view'

/** STREAM-008 phase 4: poll live chromaprint tracklist while channel is LIVE. */
export function LiveTracklistPanel({ slug }: { slug: string }) {
  const [entries, setEntries] = useState<TracklistEntry[]>([])

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const res = await fetch(`/api/channels/${slug}/live-fingerprints`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { tracklist?: TracklistEntry[] }
        if (data.tracklist?.length) setEntries(data.tracklist)
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

  if (entries.length === 0) return null

  return (
    <section className="ch-live-tracklist" aria-label="Live tracklist">
      <h2 className="ch-live-tracklist-heading">Now playing</h2>
      <TracklistView entries={entries} />
    </section>
  )
}
