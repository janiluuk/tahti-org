// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { BgCanvas } from '@/components/ui/bg-canvas'
import { usePlayer } from '@/contexts/player-context'
import HlsPlayer from './hls-player'
import ReactionsOverlay from './reactions'

interface LivePlayerSectionProps {
  url: string
  slug: string
  title?: string
}

export function LivePlayerSection({ url, slug, title }: LivePlayerSectionProps) {
  const { analyser } = usePlayer()

  return (
    <>
      <BgCanvas analyser={analyser} />
      <div id="live-player" className="ch-player-wrap">
        <div className="ch-player-inner">
          <HlsPlayer url={url} title={title} subtitle={`@${slug}`} href={`/c/${slug}`} />
        </div>
        <ReactionsOverlay slug={slug} />
      </div>
    </>
  )
}
