// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { BgCanvas } from '@/components/ui/bg-canvas'
import HlsPlayer from './hls-player'
import ReactionsOverlay from './reactions'

interface LivePlayerSectionProps {
  url: string
  slug: string
}

export function LivePlayerSection({ url, slug }: LivePlayerSectionProps) {
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)

  return (
    <>
      <BgCanvas audioEl={audioEl} />
      <div className="ch-player-wrap">
        <div className="ch-player-inner">
          <HlsPlayer url={url} onAudioMount={setAudioEl} />
        </div>
        <ReactionsOverlay slug={slug} />
      </div>
    </>
  )
}
