'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
import { useEffect } from 'react'

import { isTypingTarget } from '../lib/is-typing-target'
import type { PlayerTrack } from './player-types'

/** Site-wide keyboard shortcuts for the player (space/arrows/M) — active from
 * any page once a track is loaded. Yields to typing targets, modifier-key
 * combos (Cmd/Ctrl/Alt stay reserved for the browser/OS), and any keydown a
 * more specific widget already consumed (e.g. the mixer knob, a menu). */
export function usePlayerKeyboard(opts: {
  track: PlayerTrack | null
  volume: number
  togglePlay: () => Promise<void>
  seekBy: (deltaSeconds: number) => void
  playNext: () => boolean
  playPrevious: () => void
  setVolume: (v: number) => void
  toggleMute: () => void
}) {
  const { track, volume, togglePlay, seekBy, playNext, playPrevious, setVolume, toggleMute } = opts

  useEffect(() => {
    if (!track) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      if (isTypingTarget(e.target)) return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          void togglePlay()
          break
        case 'ArrowRight':
          e.preventDefault()
          if (e.shiftKey) playNext()
          else seekBy(10)
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (e.shiftKey) playPrevious()
          else seekBy(-10)
          break
        case 'ArrowUp':
          e.preventDefault()
          setVolume(volume + 0.05)
          break
        case 'ArrowDown':
          e.preventDefault()
          setVolume(volume - 0.05)
          break
        case 'm':
        case 'M':
          e.preventDefault()
          toggleMute()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [track, volume, togglePlay, seekBy, playNext, playPrevious, setVolume, toggleMute])
}
