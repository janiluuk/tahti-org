'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect } from 'react'
import type { PlayerTrack } from '@/contexts/player-context'
import { HearthisEmbedSurface } from '@/contexts/player-embed-plugins/hearthis-embed-plugin'

/** A hearthis.at embed has its own player chrome (play/pause/seek/volume) —
 * FullPlayerSheet's reactions, waveform, and cinema mode don't apply to it,
 * so it gets a small dialog instead of the full-viewport sheet: just the
 * embed widget, playing, in a modal the listener can dismiss. */
export function EmbedPlayerModal({
  track,
  playing,
  onClose,
  closing,
}: {
  track: PlayerTrack
  playing: boolean
  onClose: () => void
  closing: boolean
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (!track.embed) return null

  return (
    <div
      className={`embed-player-modal-overlay${closing ? ' embed-player-modal-overlay--closing' : ''}`}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="embed-player-modal" role="dialog" aria-modal="true" aria-label={track.title}>
        <header className="embed-player-modal__header">
          <span className="embed-player-modal__title">{track.title}</span>
          <button
            type="button"
            className="embed-player-modal__close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <HearthisEmbedSurface
          embedUri={track.embed.embedUri}
          title={track.title}
          autoplay={playing}
        />
      </div>
    </div>
  )
}
