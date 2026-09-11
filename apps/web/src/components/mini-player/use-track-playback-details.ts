'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
import { resolveClientApiUrl } from '@/lib/api-url'

import { useState, useEffect } from 'react'

import type { TrackPlaybackDetails } from './types'

const API_URL = resolveClientApiUrl()

/** Waveform peaks + reaction markers + show identity for the currently-loaded archive
 * track — a visual extra, so any fetch failure just leaves details null (the plain
 * progress bar and meta block still work fine without it). Polls while the sheet is
 * open so other listeners' reactions show up without a manual refresh. */
export function useTrackPlaybackDetails(trackId: string | null) {
  const [details, setDetails] = useState<TrackPlaybackDetails | null>(null)

  useEffect(() => {
    setDetails(null)
    if (!trackId) return
    let cancelled = false

    async function fetchDetails() {
      try {
        const res = await fetch(`${API_URL}/api/reactions/track/${trackId}`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as TrackPlaybackDetails
        if (!cancelled) setDetails(data)
      } catch {
        // waveform/reactions are a visual extra, not required for playback
      }
    }

    void fetchDetails()
    const interval = window.setInterval(() => void fetchDetails(), 15_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [trackId])

  return [details, setDetails] as const
}
