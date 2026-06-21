// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { trackIdFromSpotifyUri } from '@tahti/shared'

type Props = {
  title: string
  embedUri: string
}

/**
 * Mixed-source collections (View 15) — Spotify embed row. The iframe is never
 * pre-loaded; it only mounts after the listener clicks play, so Spotify never
 * sees a listener's IP just from browsing the collection page.
 */
export function SpotifyEmbedRow({ title, embedUri }: Props) {
  const [playing, setPlaying] = useState(false)
  const trackId = trackIdFromSpotifyUri(embedUri)
  if (!trackId) return null

  return (
    <li className="embed-frame-spotify">
      <span className="embed-frame-spotify__badge">SPOTIFY EMBED</span>
      {playing ? (
        <iframe
          title={title}
          src={`https://open.spotify.com/embed/track/${trackId}`}
          width="100%"
          height="80"
          style={{ border: 0 }}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      ) : (
        <button
          type="button"
          className="embed-frame-spotify__play"
          onClick={() => setPlaying(true)}
          aria-label={`Play ${title} on Spotify`}
        >
          <span className="embed-frame-spotify__play-icon" aria-hidden>
            ▶
          </span>
          <span className="embed-frame-spotify__title">{title}</span>
          <span className="embed-frame-spotify__subline">
            Listen on Spotify · account required for full track
          </span>
        </button>
      )}
    </li>
  )
}
