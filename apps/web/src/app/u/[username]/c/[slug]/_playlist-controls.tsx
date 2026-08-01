// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import type { PlayerTrack } from '@/contexts/player-context'
import { usePlayer } from '@/contexts/player-context'

/** Shuffle / Repeat mode toggles for a public collection playlist. */
export function PlaylistControls({ queue }: { queue: PlayerTrack[] }) {
  const { shuffle, toggleShuffle, repeat, toggleRepeat } = usePlayer()
  const canMode = queue.length >= 2

  if (queue.length === 0) return null

  return (
    <div className="prof-playlist-controls" role="group" aria-label="Playlist playback">
      <button
        type="button"
        className={`prof-playlist-controls__btn${shuffle ? ' prof-playlist-controls__btn--active' : ''}`}
        onClick={toggleShuffle}
        disabled={!canMode}
        aria-pressed={shuffle}
        title={shuffle ? 'Shuffle: on' : 'Shuffle: off'}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M2 4h3.2l6 8H14M14 4h-2.8L9.5 6.3M2 12h3.2l1.7-2.3M12.5 2.5 14 4l-1.5 1.5M12.5 10.5 14 12l-1.5 1.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Shuffle
      </button>
      <button
        type="button"
        className={`prof-playlist-controls__btn${repeat ? ' prof-playlist-controls__btn--active' : ''}`}
        onClick={toggleRepeat}
        disabled={!canMode}
        aria-pressed={repeat}
        title={repeat ? 'Repeat: on' : 'Repeat: off'}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M3 6a3 3 0 0 1 3-3h6M12 3l-2-2m2 2-2 2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13 10a3 3 0 0 1-3 3H4M4 13l2 2m-2-2 2-2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Repeat
      </button>
    </div>
  )
}
