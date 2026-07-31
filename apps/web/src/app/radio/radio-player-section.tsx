'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
import { TAHTI_RADIO_SLUG } from '@tahti/shared'
import HlsPlayer from '../c/[slug]/hls-player'
import ReactionsOverlay from '../c/[slug]/reactions'
import { ChannelVisualizer } from '@/components/visuals/channel-visualizer'
import { usePlayer } from '@/contexts/player-context'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'
const NOW_PLAYING_POLL_MS = 8_000

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
  nowPlaying: initialNowPlaying,
}: RadioPlayerSectionProps) {
  const { analyser, track, updateTrackMeta } = usePlayer()
  const liveElapsedSec = useLiveElapsedSec(liveSlot?.startAt ?? null)
  const [nowPlaying, setNowPlaying] = useState(initialNowPlaying)

  useEffect(() => {
    setNowPlaying(initialNowPlaying)
  }, [initialNowPlaying])

  // Poll rotation now-playing so track handoffs animate without a full page refresh.
  useEffect(() => {
    if (liveSlot) return
    let cancelled = false

    async function refresh() {
      try {
        const res = await fetch(`${API_BASE}/api/channels/${TAHTI_RADIO_SLUG}`, {
          credentials: 'include',
          cache: 'no-store',
        })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { nowPlaying: RadioNowPlayingTrack | null }
        if (!cancelled) setNowPlaying(data.nowPlaying)
      } catch {
        /* keep last known */
      }
    }

    const id = window.setInterval(() => void refresh(), NOW_PLAYING_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [liveSlot])

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

  // Keep the shared mini-player in sync when the rotation track changes (same HLS URL).
  useEffect(() => {
    if (liveSlot) return
    if (!track || track.id !== playback.audioUrl) return
    updateTrackMeta({
      title,
      subtitle,
      artworkUrl,
      href: '/radio',
    })
  }, [liveSlot, track, playback.audioUrl, title, subtitle, artworkUrl, updateTrackMeta])

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
          artOverlayPlay
          animateTrackChange
        />
      </div>
      <ReactionsOverlay slug={slug} />
    </div>
  )
}
