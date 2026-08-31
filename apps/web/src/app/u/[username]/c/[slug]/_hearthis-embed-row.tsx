// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { usePlayer, type PlayerTrack } from '@/contexts/player-context'
import { HearthisEmbedSurface } from '@/contexts/player-embed-plugins/hearthis-embed-plugin'
import { useState } from 'react'

type Props = {
  title: string
  embedUri: string
  id?: string
  durationSec?: number | null
  thumbUrl?: string | null
  queue?: PlayerTrack[]
}

/**
 * Mixed-source collections — hearthis.at embed row. Mirrors MixcloudEmbedRow:
 * the widget iframe only mounts after the listener clicks play, so hearthis.at
 * never sees a listener's IP just from browsing the collection page.
 */
export function HearthisEmbedRow({ title, embedUri }: Props) {
  const { close } = usePlayer()
  const [embedOpen, setEmbedOpen] = useState(false)

  function play() {
    // hearthis.at has no transport bridge. Close the global player and expose
    // the provider's own controls in this row instead.
    close()
    setEmbedOpen((open) => !open)
  }

  return (
    <li className="embed-frame-mixcloud">
      <span className="embed-frame-mixcloud__badge">HEARTHIS EMBED</span>
      {embedOpen ? (
        <>
          <HearthisEmbedSurface embedUri={embedUri} title={title} autoplay={false} />
          <button type="button" className="embed-frame-mixcloud__play" onClick={play}>
            Close hearthis.at player
          </button>
        </>
      ) : (
        <button
          type="button"
          className="embed-frame-mixcloud__play"
          onClick={play}
          aria-label={`Play ${title} on hearthis.at`}
        >
          <span className="embed-frame-mixcloud__play-icon" aria-hidden>
            ▶
          </span>
          <span className="embed-frame-mixcloud__title">{title}</span>
          <span className="embed-frame-mixcloud__subline">Open hearthis.at player</span>
        </button>
      )}
    </li>
  )
}
