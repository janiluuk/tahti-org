// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import type { VisualPreset } from '@tahti/shared'
import { ArchiveWaveform } from '@/components/archive-waveform'
import { ChannelVisualizer } from '@/components/visuals/channel-visualizer'
import { useAudioAnalyser } from '@/lib/use-audio-analyser'
import { ArchiveDownloadButton } from './archive-download'

interface Props {
  channelSlug: string
  artistUsername: string
  item: {
    id: string
    audioUrl: string
    peaks?: number[] | null
    visualPreset?: VisualPreset | string | null
    repostToDownload?: boolean
    followToDownload?: boolean
  }
  colorSchemeJson?: string | null
}

export function ArchiveItemPlayback({ channelSlug, artistUsername, item, colorSchemeJson }: Props) {
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const analyser = useAudioAnalyser(audioEl, playing)
  const preset = (item.visualPreset ?? 'MINIMAL') as VisualPreset
  const showViz = playing && preset !== 'MINIMAL'

  return (
    <div className="ch-archive-playback">
      {showViz && (
        <ChannelVisualizer
          preset={preset}
          colorSchemeJson={colorSchemeJson}
          analyser={analyser}
          className="ch-archive-item-viz"
        />
      )}
      <ArchiveWaveform peaks={item.peaks} />
      <audio
        ref={setAudioEl}
        controls
        src={item.audioUrl}
        className="ch-archive-audio"
        data-testid="channel-archive-player"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <ArchiveDownloadButton
        channelSlug={channelSlug}
        artistUsername={artistUsername}
        itemId={item.id}
        repostToDownload={Boolean(item.repostToDownload)}
        followToDownload={Boolean(item.followToDownload)}
      />
    </div>
  )
}
