'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import HlsPlayer from '../c/[slug]/hls-player'
import ReactionsOverlay from '../c/[slug]/reactions'
import { RadioInfoOverlay } from './radio-info-overlay'
import type { PublicRadioSlot } from './actions'

interface RadioRotationItem {
  id: string
  title: string
  artistName: string
  artistUsername: string
}

interface RadioMemberRelay {
  slug: string
  artistName: string
}

interface RadioPlayerSectionProps {
  playback: { kind: 'audio'; audioUrl: string }
  slug: string
  rotation: RadioRotationItem[]
  slots: PublicRadioSlot[]
  memberRelay: RadioMemberRelay | null
}

export function RadioPlayerSection({
  playback,
  slug,
  rotation,
  slots,
  memberRelay,
}: RadioPlayerSectionProps) {
  return (
    <div id="live-player" className="ch-player-wrap">
      <div className="ch-player-inner">
        <HlsPlayer url={playback.audioUrl} title="Tahti Radio" subtitle="24/7 live" href="/radio" />
      </div>
      <RadioInfoOverlay rotation={rotation} slots={slots} memberRelay={memberRelay} />
      <ReactionsOverlay slug={slug} />
    </div>
  )
}
