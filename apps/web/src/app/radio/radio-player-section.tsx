'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState } from 'react'
import type { ActiveRadioPlayback } from '@tahti/shared'
import { BgCanvas } from '@/components/ui/bg-canvas'
import HlsPlayer from '../c/[slug]/hls-player'
import ReactionsOverlay from '../c/[slug]/reactions'

interface RadioPlayerSectionProps {
  playback: Exclude<ActiveRadioPlayback, { kind: 'none' }>
  slug: string
}

function RadioVideoPlayer({ embedUrl, slug }: { embedUrl: string; slug: string }) {
  return (
    <>
      <BgCanvas variant="subtle" />
      <div id="live-player" className="ch-player-wrap">
        <div className="ch-player-inner ch-player-inner--video">
          <iframe
            title="Tahti Radio"
            className="ch-youtube-player"
            src={embedUrl}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
        <ReactionsOverlay slug={slug} />
      </div>
    </>
  )
}

function RadioAudioPlayer({ audioUrl, slug }: { audioUrl: string; slug: string }) {
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)

  return (
    <>
      <BgCanvas variant="subtle" audioEl={audioEl} />
      <div id="live-player" className="ch-player-wrap">
        <div className="ch-player-inner">
          <HlsPlayer url={audioUrl} onAudioMount={setAudioEl} />
        </div>
        <ReactionsOverlay slug={slug} />
      </div>
    </>
  )
}

export function RadioPlayerSection({ playback, slug }: RadioPlayerSectionProps) {
  if (playback.kind === 'video') {
    return <RadioVideoPlayer embedUrl={playback.embedUrl} slug={slug} />
  }
  return <RadioAudioPlayer audioUrl={playback.audioUrl} slug={slug} />
}
