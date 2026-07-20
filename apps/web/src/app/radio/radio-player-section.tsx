'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
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

interface RadioLiveSlot {
  startAt: string
  artist: {
    displayName: string
    avatarUrl: string | null
  }
}

interface RadioNowPlayingTrack {
  title: string
  artistName: string
  artworkUrl: string | null
}

interface RadioPlayerSectionProps {
  playback: { kind: 'audio'; audioUrl: string }
  slug: string
  rotation: RadioRotationItem[]
  slots: PublicRadioSlot[]
  memberRelay: RadioMemberRelay | null
  /** The currently-active booked slot, if any — gates elapsed time + real artist
   * artwork/title. Continuous rotation playback (no live artist) passes null. */
  liveSlot: RadioLiveSlot | null
  /** STREAM-012: the orchestrator's synced rotation track, when fresh. Only used
   * while there's no liveSlot — a real booking always takes precedence. */
  nowPlaying: RadioNowPlayingTrack | null
}

/** Ticks once a second so the live-show elapsed time stays live without polling. */
function useLiveElapsedSec(startAt: string | null): number | undefined {
  const [elapsed, setElapsed] = useState<number>()

  useEffect(() => {
    if (!startAt) {
      setElapsed(undefined)
      return
    }
    const startMs = new Date(startAt).getTime()
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startAt])

  return elapsed
}

export function RadioPlayerSection({
  playback,
  slug,
  rotation,
  slots,
  memberRelay,
  liveSlot,
  nowPlaying,
}: RadioPlayerSectionProps) {
  const liveElapsedSec = useLiveElapsedSec(liveSlot?.startAt ?? null)

  const title = liveSlot ? liveSlot.artist.displayName : (nowPlaying?.title ?? 'Tahti Radio')
  const subtitle = liveSlot
    ? 'Live now on Tahti Radio'
    : (nowPlaying?.artistName ?? '24/7 rotation')
  const artworkUrl = liveSlot ? liveSlot.artist.avatarUrl : (nowPlaying?.artworkUrl ?? null)

  return (
    <div id="live-player" className="ch-player-wrap">
      <div className="ch-player-inner">
        <HlsPlayer
          url={playback.audioUrl}
          title={title}
          subtitle={subtitle}
          artworkUrl={artworkUrl}
          liveElapsedSec={liveElapsedSec}
          href="/radio"
        />
      </div>
      <RadioInfoOverlay rotation={rotation} slots={slots} memberRelay={memberRelay} />
      <ReactionsOverlay slug={slug} />
    </div>
  )
}
