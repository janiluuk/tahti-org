// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import HlsPlayer from './hls-player'
import ReactionsOverlay from './reactions'
import { resolveChannelUrl } from '@/lib/app-url'

interface LivePlayerSectionProps {
  url: string
  slug: string
  title?: string
  subtitle?: string
  subtitleHref?: string
  artworkUrl?: string | null
  isReplay?: boolean
  nextUpLabel?: string
}

export function LivePlayerSection({
  url,
  slug,
  title,
  subtitle,
  subtitleHref,
  artworkUrl,
  isReplay,
  nextUpLabel,
}: LivePlayerSectionProps) {
  return (
    <div id="live-player" className="ch-player-wrap">
      <div className="ch-player-inner">
        <HlsPlayer
          url={url}
          title={title}
          subtitle={subtitle ?? `@${slug}`}
          subtitleHref={subtitleHref}
          href={resolveChannelUrl(slug)}
          artworkUrl={artworkUrl}
          isReplay={isReplay}
          nextUpLabel={nextUpLabel}
        />
      </div>
      <ReactionsOverlay slug={slug} />
    </div>
  )
}
