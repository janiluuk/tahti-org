'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
import HlsPlayer from '../c/[slug]/hls-player'
import ReactionsOverlay from '../c/[slug]/reactions'
import { ChannelVisualizer } from '@/components/visuals/channel-visualizer'
import { usePlayer } from '@/contexts/player-context'

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
  artistUsername: string | null
  artworkUrl: string | null
}

interface RadioPlayerSectionProps {
  playback: { kind: 'audio'; audioUrl: string }
  slug: string
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
  liveSlot,
  nowPlaying,
}: RadioPlayerSectionProps) {
  const { analyser } = usePlayer()
  const liveElapsedSec = useLiveElapsedSec(liveSlot?.startAt ?? null)

  const title = liveSlot ? liveSlot.artist.displayName : (nowPlaying?.title ?? 'Tahti Radio')
  // Always name the channel in the subtitle — live and rotation/replay alike —
  // so a listener glancing at the mini-player elsewhere on the site can tell
  // it's Tahti Radio playing, not just some artist's name in isolation.
  const subtitle = liveSlot
    ? 'Live now on Tahti Radio'
    : nowPlaying?.artistName
      ? `${nowPlaying.artistName} on Tahti Radio`
      : 'Tahti Radio · 24/7 rotation'
  const subtitleHref =
    !liveSlot && nowPlaying?.artistUsername ? `/u/${nowPlaying.artistUsername}` : undefined
  const artworkUrl = liveSlot ? liveSlot.artist.avatarUrl : (nowPlaying?.artworkUrl ?? null)

  return (
    <div id="live-player" className="ch-player-wrap ch-radio-player-wrap">
      <div className="ch-player-inner">
        <ChannelVisualizer
          preset="REACTIVE_GRID"
          analyser={analyser}
          className="ch-radio-player-viz"
        />
        <HlsPlayer
          url={playback.audioUrl}
          title={title}
          subtitle={subtitle}
          subtitleHref={subtitleHref}
          artworkUrl={artworkUrl}
          liveElapsedSec={liveElapsedSec}
          isReplay={!liveSlot}
          href="/radio"
          hideWaveform
        />
      </div>
      <ReactionsOverlay slug={slug} />
    </div>
  )
}
