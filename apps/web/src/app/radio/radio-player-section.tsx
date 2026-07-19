'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import HlsPlayer from '../c/[slug]/hls-player'
import ReactionsOverlay from '../c/[slug]/reactions'

interface RadioPlayerSectionProps {
  playback: { kind: 'audio'; audioUrl: string }
  slug: string
}

export function RadioPlayerSection({ playback, slug }: RadioPlayerSectionProps) {
  return (
    <div id="live-player" className="ch-player-wrap">
      <div className="ch-player-inner">
        <HlsPlayer url={playback.audioUrl} title="Tahti Radio" subtitle="24/7 live" href="/radio" />
      </div>
      <ReactionsOverlay slug={slug} />
    </div>
  )
}
