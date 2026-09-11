'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
import { useEffect } from 'react'

import type { PlayerTrack } from './player-types'

/** Tab title reflects what's actually playing, so radio.tahti.live is
 * identifiable from a background tab — restored once nothing is loaded. */
export function usePlayerDocumentTitle(opts: { track: PlayerTrack | null; playing: boolean }) {
  const { track, playing } = opts

  useEffect(() => {
    const original = document.title
    if (track && playing) {
      document.title = track.subtitle ? `${track.title} — ${track.subtitle}` : track.title
    }
    return () => {
      document.title = original
    }
  }, [track, playing])
}
