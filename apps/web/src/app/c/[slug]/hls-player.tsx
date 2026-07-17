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
  waitingForSignal = false,
}: {
  url: string
  title?: string
  subtitle?: string
  href?: string
  /** No source connected yet (broadcast test-signal step) — shows a waiting animation. */
  waitingForSignal?: boolean
}) {
  const { track, playing, buffering, currentTime, duration, load, togglePlay, seek } = usePlayer()

  const isCurrent = track?.id === url
  const handleTogglePlay = async () => {
    if (!isCurrent) {
      load(
        { id: url, kind: 'live', url, title: title ?? 'Live stream', subtitle, href },
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
  const activeCurrentTime = isCurrent ? currentTime : 0
  const activeDuration = isCurrent ? duration : 0
  const isLive = !isCurrent || !Number.isFinite(activeDuration) || activeDuration === 0
  const formatBadge = url.toLowerCase().includes('flac') ? 'FLAC' : 'HLS'

  return (
    <div className="ch-player-card">
      <WaveformPlayer
        embedded
        playing={activePlaying}
        buffering={activeBuffering}
        isLive={isLive}
        currentTime={activeCurrentTime}
        duration={activeDuration}
        formatBadge={formatBadge}
        onTogglePlay={handleTogglePlay}
        onSeek={isLive ? undefined : handleSeek}
        waitingForSignal={waitingForSignal}
      />
    </div>
  )
}
