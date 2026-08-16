// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { hearthisEmbedSrc } from '@tahti/shared'

type Props = {
  title: string
  embedUri: string
}

/**
 * Mixed-source collections — hearthis.at embed row. Mirrors MixcloudEmbedRow:
 * the widget iframe only mounts after the listener clicks play, so hearthis.at
 * never sees a listener's IP just from browsing the collection page.
 */
export function HearthisEmbedRow({ title, embedUri }: Props) {
  const [playing, setPlaying] = useState(false)

  return (
    <li className="embed-frame-mixcloud">
      <span className="embed-frame-mixcloud__badge">HEARTHIS EMBED</span>
      {playing ? (
        <iframe
          title={title}
          src={hearthisEmbedSrc(embedUri)}
          width="100%"
          height="120"
          style={{ border: 0 }}
          allow="autoplay"
          loading="lazy"
        />
      ) : (
        <button
          type="button"
          className="embed-frame-mixcloud__play"
          onClick={() => setPlaying(true)}
          aria-label={`Play ${title} on hearthis.at`}
        >
          <span className="embed-frame-mixcloud__play-icon" aria-hidden>
            ▶
          </span>
          <span className="embed-frame-mixcloud__title">{title}</span>
          <span className="embed-frame-mixcloud__subline">Listen on hearthis.at</span>
        </button>
      )}
    </li>
  )
}
