// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { WaveformPlayer } from '@tahti/ui'
import { usePlayer } from '@/contexts/player-context'

export default function HlsPlayer({
  url,
  title,
  subtitle,
  href,
  artworkUrl,
  liveElapsedSec,
  isReplay = false,
  waitingForSignal = false,
}: {
  url: string
  title?: string
  subtitle?: string
  href?: string
  artworkUrl?: string | null
  /** Wall-clock seconds since a live broadcast began — shown instead of "LIVE".
   * Leave unset for continuous/rotation playback (no meaningful elapsed time). */
  liveElapsedSec?: number
  /** This is a continuous/unseekable stream but nobody is actually on air right
   * now (e.g. Tahti Radio playing its rotation) — shows "REPLAY" instead of the
   * misleading "LIVE NOW". Leave false for genuine live broadcasts. */
  isReplay?: boolean
  /** No source connected yet (broadcast test-signal step) — shows a waiting animation. */
  waitingForSignal?: boolean
}) {
  const { track, playing, buffering, error, currentTime, duration, load, togglePlay, seek } =
    usePlayer()

  const isCurrent = track?.id === url
  const handleTogglePlay = async () => {
    if (!isCurrent) {
      load(
        {
          id: url,
          kind: 'live',
          url,
          title: title ?? 'Live stream',
          subtitle,
          href,
          artworkUrl,
          isReplay,
        },
        { autoplay: true },
      )
      return
    }
    await togglePlay()
  }

  const handleSeek = (ratio: number) => {
    if (isCurrent) seek(ratio)
  }

  const activePlaying = isCurrent && playing
  const activeBuffering = isCurrent && buffering
  const activeError = isCurrent && error
  const activeCurrentTime = isCurrent ? currentTime : 0
  const activeDuration = isCurrent ? duration : 0
  // HlsPlayer is only ever used for continuous streams (every load() call above
  // hardcodes kind: 'live') — never infer "is this live" from audio.duration,
  // since that's genuinely browser-dependent for an open-ended HLS stream: Chromium
  // reports Infinity/NaN as expected, but Firefox's MSE implementation reports a
  // finite duration matching the currently buffered window (confirmed live against
  // production — ~16s, matching the segment window size). Treating that as "this
  // is a short, finite, seekable track" flipped the UI into archive-player mode
  // and made playback appear to end once currentTime caught up to that number.
  const isLive = true
  const formatBadge = url.toLowerCase().includes('flac') ? 'FLAC' : 'HLS'

  return (
    <div className="ch-player-card">
      <WaveformPlayer
        embedded
        playing={activePlaying}
        buffering={activeBuffering}
        offline={activeError}
        isLive={isLive}
        currentTime={activeCurrentTime}
        duration={activeDuration}
        formatBadge={formatBadge}
        onTogglePlay={handleTogglePlay}
        onSeek={isLive ? undefined : handleSeek}
        waitingForSignal={waitingForSignal}
        artworkUrl={artworkUrl}
        nowPlayingTitle={title}
        nowPlayingSubtitle={subtitle}
        liveElapsedSec={isLive ? liveElapsedSec : undefined}
        isReplay={isReplay}
      />
    </div>
  )
}
