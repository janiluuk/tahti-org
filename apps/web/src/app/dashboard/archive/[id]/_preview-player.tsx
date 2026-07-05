// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { WaveformPlayer } from '@tahti/ui'
import { usePlayer } from '@/contexts/player-context'

export function ArchivePreviewPlayer({
  itemId,
  title,
  audioUrl,
  durationSec,
}: {
  itemId: string
  title: string
  audioUrl: string
  durationSec: number | null
}) {
  const { track, playing, buffering, currentTime, duration, load, togglePlay, seek } = usePlayer()
  const isCurrent = track?.id === itemId

  async function handleTogglePlay() {
    if (!isCurrent) {
      load({ id: itemId, kind: 'archive', url: audioUrl, title }, { autoplay: true })
      return
    }
    await togglePlay()
  }

  return (
    <WaveformPlayer
      playing={isCurrent && playing}
      buffering={isCurrent && buffering}
      isLive={false}
      currentTime={isCurrent ? currentTime : 0}
      duration={isCurrent ? duration : (durationSec ?? 0)}
      formatBadge="Preview"
      onTogglePlay={() => void handleTogglePlay()}
      onSeek={(ratio) => isCurrent && seek(ratio)}
    />
  )
}
